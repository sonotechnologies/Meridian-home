"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { saveListingStep, submitListing } from "@/server/actions/agent";
import { naira, priceUnit, PROPERTY_TYPES, TITLE_DOCUMENTS } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import { AMENITIES, feeAmount, totalUpfront, type FeeInput } from "@/lib/listing-rules";
import { issuesToErrors, priceStepFor, STEP_NAMES, stepSchemas, type StepNumber } from "@/lib/listing-schema";
import { uploadFile } from "@/lib/upload-client";
import { Icon } from "../icon";
import { PinDropMap } from "../map/pin-drop-map";
import { useToast } from "../toast";
import { Button, Card, chipClass, cx, Field, inputClass } from "../ui";

import { EMPTY_FORM, type AreaOpt, type FeeState, type FormState } from "@/lib/listing-form-state";

export { EMPTY_FORM, type AreaOpt, type FormState };

const digits = (s: string) => s.replace(/[^\d.]/g, "");
const num = (s: string) => Number(digits(s) || 0);

function payload(step: StepNumber, s: FormState) {
  switch (step) {
    case 1:
      return { type: s.type, propertyType: s.propertyType, title: s.title, description: s.description };
    case 2:
      return { areaId: s.areaId ?? 0, lng: s.lng ?? 0, lat: s.lat ?? 0, streetName: s.streetName || undefined, showStreet: s.showStreet };
    case 3:
      return {
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms,
        toilets: s.toilets,
        parking: s.parking,
        sizeSqm: s.sizeSqm,
        furnished: s.furnished,
        serviced: s.serviced,
        amenities: s.amenities,
      };
    case 4: {
      const fee = (f: FeeState) => ({ mode: f.mode, value: num(f.value) });
      return {
        price: num(s.price),
        ...(s.type === "rent"
          ? { rent: { agencyFee: fee(s.rent.agencyFee), legalFee: fee(s.rent.legalFee), cautionDeposit: fee(s.rent.cautionDeposit), serviceCharge: fee(s.rent.serviceCharge) } }
          : {}),
        ...(s.type === "sale" ? { sale: s.sale } : {}),
        ...(s.type === "shortlet" ? { shortlet: { minNights: num(s.shortlet.minNights), cleaningFee: num(s.shortlet.cleaningFee), cautionDeposit: num(s.shortlet.cautionDeposit) } } : {}),
      };
    }
    case 5:
      return { images: s.images };
  }
}

export function ListingForm({
  listingId: initialId,
  initial,
  initialStep,
  reached,
  areas,
  trusted,
  status,
}: {
  listingId: string | null;
  initial: FormState;
  initialStep: number;
  reached: number;
  areas: AreaOpt[];
  trusted: boolean;
  status: string;
}) {
  const [id, setId] = useState(initialId);
  const [s, setS] = useState<FormState>(initial);
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), 6));
  const [maxStep, setMaxStep] = useState(Math.max(reached, initialStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const top = useRef<HTMLDivElement>(null);

  const set = (p: Partial<FormState>) => {
    setS((cur) => ({ ...cur, ...p }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p)) for (const ek of Object.keys(next)) if (ek === k || ek.startsWith(k + ".")) delete next[ek];
      return next;
    });
  };

  const go = (n: number) => {
    setStep(n);
    setErrors({});
    setFormError(null);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", id ? `/dashboard/listings/${id}/edit?step=${n}` : window.location.pathname);
  };

  /** Validate with the shared schema, then save the step as a draft. */
  const saveAndContinue = () => {
    const n = step as StepNumber;
    const data = payload(n, s);
    const schema = n === 4 ? priceStepFor(s.type) : stepSchemas[n];
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      setFormError("Check the highlighted fields.");
      return;
    }
    start(async () => {
      const r = await saveListingStep(id, n, data);
      if (!r.ok) {
        if (r.errors) setErrors(r.errors);
        setFormError(r.error ?? "Check the highlighted fields.");
        return;
      }
      if (!id) {
        // The draft now exists: move to its edit route straight away. Rewriting the URL in
        // place would let a later server-action refresh swap routes and remount the form
        // mid-typing, losing input.
        setId(r.id);
        router.replace(`/dashboard/listings/${r.id}/edit?step=2`);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }));
      setMaxStep((m) => Math.max(m, n + 1));
      setStep(n + 1);
      setErrors({});
      setFormError(null);
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (id) window.history.replaceState(null, "", `/dashboard/listings/${id}/edit?step=${n + 1}`);
    });
  };

  const submit = () =>
    start(async () => {
      if (!id) return;
      const r = await submitListing(id);
      if (!r.ok) return setFormError(r.error ?? "Could not post the listing.");
      toast(r.status === "active" ? "Posted. Your listing is on the map." : "Sent for review. We usually check new listings within a day.");
      router.push("/dashboard/listings");
      router.refresh();
    });

  return (
    <div ref={top} className="mx-auto flex max-w-[860px] scroll-mt-20 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">{initialId ? "Edit listing" : "Post a listing"}</h1>
        <span className="text-sm text-muted" aria-live="polite">
          {pending ? "Saving…" : savedAt ? `Draft saved at ${savedAt}` : id ? "Drafts save at every step" : null}
        </span>
      </div>

      <Progress step={step} maxStep={maxStep} onJump={(n) => n <= maxStep && id && go(n)} />

      {formError ? (
        <p role="alert" className="m-0 rounded-[6px] border border-danger bg-surface px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 6) saveAndContinue();
          else submit();
        }}
        className="flex flex-col gap-6"
      >
        {step === 1 ? <StepBasics s={s} set={set} errors={errors} /> : null}
        {step === 2 ? <StepLocation s={s} set={set} errors={errors} areas={areas} /> : null}
        {step === 3 ? <StepSpecs s={s} set={set} errors={errors} /> : null}
        {step === 4 ? <StepPrice s={s} set={set} errors={errors} /> : null}
        {step === 5 ? <StepPhotos s={s} set={set} errors={errors} /> : null}
        {step === 6 ? <StepReview s={s} areas={areas} trusted={trusted} status={status} onEdit={go} /> : null}

        <div className="sticky bottom-[72px] z-10 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-paper px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 lg:bottom-0">
          {step > 1 ? (
            <Button type="button" onClick={() => go(step - 1)}>
              <Icon n="left" size={16} />
              Back
            </Button>
          ) : (
            <Link href="/dashboard/listings" className="text-sm font-semibold">
              Cancel
            </Link>
          )}
          {step < 6 ? (
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Saving…" : "Save and continue"}
              <Icon n="right" size={16} />
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="lg" disabled={pending}>
              {trusted || status === "active" ? "Post listing" : "Send for review"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ---------- Numbered progress bar with plain step names ---------- */

function Progress({ step, maxStep, onJump }: { step: number; maxStep: number; onJump: (n: number) => void }) {
  return (
    <nav aria-label="Form progress">
      <p className="m-0 mb-2 text-sm text-muted sm:hidden">
        Step <span className="font-mono">{step}</span> of <span className="font-mono">6</span> · <span className="font-semibold text-ink">{STEP_NAMES[step - 1]}</span>
      </p>
      <div className="h-1 rounded-full bg-line sm:hidden">
        <div className="h-full rounded-full bg-green transition-[width] duration-200" style={{ width: `${(step / 6) * 100}%` }} />
      </div>
      <ol className="m-0 hidden list-none gap-2 p-0 sm:flex">
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          const reachable = n <= maxStep;
          return (
            <li key={name} className="flex flex-1 flex-col gap-2">
              <div className={cx("h-1 rounded-full", n <= step ? "bg-green" : "bg-line")} />
              <button
                type="button"
                disabled={!reachable || current}
                aria-current={current ? "step" : undefined}
                onClick={() => onJump(n)}
                className={cx("flex items-center gap-2 border-0 bg-transparent p-0 text-left text-[13px]", current ? "font-semibold text-ink" : reachable ? "text-green" : "text-muted", "disabled:cursor-default")}
              >
                <span className={cx("flex h-6 w-6 flex-none items-center justify-center rounded-full font-mono text-xs", current ? "bg-green text-white" : done ? "bg-green-tint text-green" : "border border-line text-muted")}>
                  {done ? <Icon n="check" size={14} stroke={2} /> : n}
                </span>
                {name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type StepProps = { s: FormState; set: (p: Partial<FormState>) => void; errors: Record<string, string> };

function Section({ title, children, lead }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-2xl font-semibold leading-8">{title}</h2>
        {lead ? <p className="m-0 text-[15px] text-muted">{lead}</p> : null}
      </div>
      {children}
    </Card>
  );
}

const err = (errors: Record<string, string>, k: string) => errors[k];

/* ---------- Step 1 ---------- */

function StepBasics({ s, set, errors }: StepProps) {
  const id = useId();
  return (
    <Section title="Type and basics">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id={`${id}-type`}>
          Listing type
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-type`} className="flex flex-wrap gap-2">
          {(["rent", "sale", "shortlet"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={s.type === t} className={chipClass(s.type === t)} onClick={() => set({ type: t })}>
              {t === "rent" ? "For rent" : t === "sale" ? "For sale" : "Shortlet"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id={`${id}-pt`}>
          Property type
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-pt`} className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={s.propertyType === v} className={chipClass(s.propertyType === v)} onClick={() => set({ propertyType: v })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Field id={`${id}-title`} label="Title" hint="Plain and specific: “2 bedroom flat with BQ”, not “Luxury dream home”." error={err(errors, "title")}>
        <input
          id={`${id}-title`}
          className={inputClass}
          value={s.title}
          maxLength={80}
          onChange={(e) => set({ title: e.target.value })}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${id}-title-error` : `${id}-title-hint`}
        />
      </Field>
      <Field id={`${id}-desc`} label="Description" hint="Water, power, security, parking, what’s nearby. At least 40 characters." error={err(errors, "description")}>
        <textarea
          id={`${id}-desc`}
          rows={6}
          className={inputClass + " h-auto py-2.5 leading-6"}
          value={s.description}
          maxLength={3000}
          onChange={(e) => set({ description: e.target.value })}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? `${id}-desc-error` : `${id}-desc-hint`}
        />
      </Field>
    </Section>
  );
}

/* ---------- Step 2 ---------- */

function StepLocation({ s, set, errors, areas }: StepProps & { areas: AreaOpt[] }) {
  const id = useId();
  const [flyKey, setFlyKey] = useState<string>();
  const area = areas.find((a) => a.id === s.areaId);
  return (
    <Section title="Location" lead="Choose the area, then drag the pin to the building. Buyers only see the general area.">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id={`${id}-area`}>
          Area
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-area`} className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={s.areaId === a.id}
              className={chipClass(s.areaId === a.id)}
              onClick={() => {
                set({ areaId: a.id, lng: a.lng, lat: a.lat });
                setFlyKey(`${a.id}-${Date.now()}`);
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
        {errors.areaId ? <span className="text-[13px] text-danger">{errors.areaId}</span> : null}
      </div>
      {area && s.lng != null && s.lat != null ? (
        <div className="flex flex-col gap-2">
          <div className="relative h-[420px] overflow-hidden rounded-[10px] border border-line sm:h-[480px]">
            <PinDropMap lng={s.lng} lat={s.lat} flyKey={flyKey} onChange={(lng, lat) => set({ lng, lat })} />
          </div>
          <p className="m-0 text-sm text-muted">Drag the pin to the building. Buyers only see the general area.</p>
          {errors.lng || errors.lat ? <span className="text-[13px] text-danger">{errors.lng ?? errors.lat}</span> : null}
        </div>
      ) : (
        <div className="contour-bg flex h-[200px] items-center justify-center rounded-[10px] border border-line text-sm text-muted">
          <span className="rounded-[6px] bg-paper/90 px-3 py-1">Choose an area to place the pin</span>
        </div>
      )}
      <Field id={`${id}-street`} label="Street name (optional)" hint="Only shown if you tick the box below.">
        <input id={`${id}-street`} className={inputClass} value={s.streetName} maxLength={80} onChange={(e) => set({ streetName: e.target.value })} />
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
        <input type="checkbox" checked={s.showStreet} onChange={(e) => set({ showStreet: e.target.checked })} className="h-5 w-5 accent-[var(--green)]" />
        Show the street name on the listing
      </label>
    </Section>
  );
}

/* ---------- Step 3 ---------- */

function Stepper({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface disabled:opacity-40">
          <Icon n="minus" size={18} />
        </button>
        <span className="w-8 text-center font-mono text-lg" aria-live="polite" aria-label={`${value} ${label.toLowerCase()}`}>
          {value}
        </span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(value + 1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface">
          <Icon n="plus" size={18} />
        </button>
      </div>
    </div>
  );
}

function StepSpecs({ s, set, errors }: StepProps) {
  const id = useId();
  return (
    <Section title="Specs">
      <div className="flex flex-col">
        <Stepper label="Bedrooms" value={s.bedrooms} onChange={(bedrooms) => set({ bedrooms })} />
        <Stepper label="Bathrooms" value={s.bathrooms} onChange={(bathrooms) => set({ bathrooms })} />
        <Stepper label="Toilets" value={s.toilets} onChange={(toilets) => set({ toilets })} />
        <Stepper label="Parking spaces" value={s.parking} onChange={(parking) => set({ parking })} />
      </div>
      <Field id={`${id}-size`} label="Size in m² (optional)" error={err(errors, "sizeSqm")}>
        <input id={`${id}-size`} inputMode="numeric" className={inputClass + " max-w-[200px] font-mono"} value={s.sizeSqm} onChange={(e) => set({ sizeSqm: digits(e.target.value) })} aria-invalid={Boolean(errors.sizeSqm)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={s.furnished} className={chipClass(s.furnished)} onClick={() => set({ furnished: !s.furnished })}>
          {s.furnished ? <Icon n="check" size={16} /> : null}Furnished
        </button>
        <button type="button" aria-pressed={s.serviced} className={chipClass(s.serviced)} onClick={() => set({ serviced: !s.serviced })}>
          {s.serviced ? <Icon n="check" size={16} /> : null}Serviced
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Amenities</span>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => {
            const on = s.amenities.includes(a);
            return (
              <button key={a} type="button" aria-pressed={on} className={chipClass(on)} onClick={() => set({ amenities: on ? s.amenities.filter((x) => x !== a) : [...s.amenities, a] })}>
                {on ? <Icon n="check" size={16} /> : null}
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

/* ---------- Step 4: price, with the total upfront cost updating live ---------- */

function MoneyInput({ id, value, onChange, invalid, describedBy, className }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string; className?: string }) {
  const n = digits(value);
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted">₦</span>
      <input
        id={id}
        inputMode="numeric"
        className={inputClass + " pl-7 font-mono"}
        value={n ? Number(n).toLocaleString("en-NG") : ""}
        onChange={(e) => onChange(digits(e.target.value))}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
    </div>
  );
}

function FeeRow({ label, k, s, set, errors }: { label: string; k: keyof FormState["rent"] } & StepProps) {
  const id = useId();
  const f = s.rent[k];
  const rent = num(s.price);
  const amount = feeAmount({ mode: f.mode, value: num(f.value) } as FeeInput, rent);
  const setFee = (p: Partial<FeeState>) => set({ rent: { ...s.rent, [k]: { ...f, ...p } } });
  const e = errors[`rent.${k}.value`];
  return (
    <div className="flex flex-col gap-1.5 border-b border-dashed border-line pb-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-[15px] font-medium">
          {label}
        </label>
        <div role="radiogroup" aria-label={`${label} as`} className="flex rounded-[6px] border border-line bg-surface p-0.5">
          {(["percent", "amount"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={f.mode === m}
              onClick={() => setFee({ mode: m, value: "" })}
              className={cx("h-8 rounded-[4px] border-0 px-3 text-[13px] font-semibold", f.mode === m ? "bg-green text-white" : "bg-transparent text-muted")}
            >
              {m === "percent" ? "% of rent" : "Amount"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {f.mode === "percent" ? (
          <div className="relative w-[140px]">
            <input id={id} inputMode="decimal" className={inputClass + " pr-8 font-mono"} value={f.value} onChange={(ev) => setFee({ value: digits(ev.target.value) })} aria-invalid={Boolean(e)} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-muted">%</span>
          </div>
        ) : (
          <MoneyInput id={id} value={f.value} onChange={(value) => setFee({ value })} invalid={Boolean(e)} className="w-[220px]" />
        )}
        {f.mode === "percent" ? <span className="font-mono text-sm text-muted">= {naira(amount)}</span> : null}
      </div>
      {e ? <span className="text-[13px] text-danger">{e}</span> : null}
    </div>
  );
}

function StepPrice({ s, set, errors }: StepProps) {
  const id = useId();
  const rent = num(s.price);
  const fees = {
    agencyFee: feeAmount({ mode: s.rent.agencyFee.mode, value: num(s.rent.agencyFee.value) }, rent),
    legalFee: feeAmount({ mode: s.rent.legalFee.mode, value: num(s.rent.legalFee.value) }, rent),
    cautionDeposit: feeAmount({ mode: s.rent.cautionDeposit.mode, value: num(s.rent.cautionDeposit.value) }, rent),
    serviceCharge: feeAmount({ mode: s.rent.serviceCharge.mode, value: num(s.rent.serviceCharge.value) }, rent),
  };
  const total = totalUpfront(rent, fees);
  const label = s.type === "rent" ? "Yearly rent" : s.type === "shortlet" ? "Nightly rate" : "Asking price";
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
      <Section title="Price">
        <Field id={`${id}-price`} label={label} hint={s.type !== "sale" ? `Shown as ${priceUnit(s.type)}` : "Shown with no unit."} error={err(errors, "price")}>
          <MoneyInput id={`${id}-price`} value={s.price} onChange={(price) => set({ price })} invalid={Boolean(errors.price)} describedBy={errors.price ? `${id}-price-error` : `${id}-price-hint`} className="max-w-[280px]" />
        </Field>
        {s.type === "rent" ? (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-sm text-muted">Enter each fee as a percentage of rent or an amount. Put 0 if there’s no fee.</p>
            <FeeRow label="Agency fee" k="agencyFee" s={s} set={set} errors={errors} />
            <FeeRow label="Legal fee" k="legalFee" s={s} set={set} errors={errors} />
            <FeeRow label="Caution deposit (refundable)" k="cautionDeposit" s={s} set={set} errors={errors} />
            <FeeRow label="Service charge, 1 year" k="serviceCharge" s={s} set={set} errors={errors} />
          </div>
        ) : null}
        {s.type === "sale" ? (
          <>
            <Field id={`${id}-doc`} label="Title document">
              <select id={`${id}-doc`} className={inputClass + " max-w-[320px]"} value={s.sale.titleDocument} onChange={(e) => set({ sale: { ...s.sale, titleDocument: e.target.value } })}>
                {TITLE_DOCUMENTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
              <input type="checkbox" checked={s.sale.negotiable} onChange={(e) => set({ sale: { ...s.sale, negotiable: e.target.checked } })} className="h-5 w-5 accent-[var(--green)]" />
              The price is negotiable
            </label>
          </>
        ) : null}
        {s.type === "shortlet" ? (
          <>
            <Field id={`${id}-min`} label="Minimum stay (nights)" error={err(errors, "shortlet.minNights")}>
              <input id={`${id}-min`} inputMode="numeric" className={inputClass + " max-w-[140px] font-mono"} value={s.shortlet.minNights} onChange={(e) => set({ shortlet: { ...s.shortlet, minNights: digits(e.target.value) } })} />
            </Field>
            <Field id={`${id}-clean`} label="Cleaning fee" error={err(errors, "shortlet.cleaningFee")}>
              <MoneyInput id={`${id}-clean`} value={s.shortlet.cleaningFee} onChange={(cleaningFee) => set({ shortlet: { ...s.shortlet, cleaningFee } })} className="max-w-[280px]" />
            </Field>
            <Field id={`${id}-dep`} label="Caution deposit (refundable)" error={err(errors, "shortlet.cautionDeposit")}>
              <MoneyInput id={`${id}-dep`} value={s.shortlet.cautionDeposit} onChange={(cautionDeposit) => set({ shortlet: { ...s.shortlet, cautionDeposit } })} className="max-w-[280px]" />
            </Field>
          </>
        ) : null}
      </Section>

      {s.type === "rent" ? (
        <Card className="sticky top-24 flex flex-col gap-3 p-5" aria-live="polite">
          <h3 className="m-0 text-lg font-semibold">What buyers will see</h3>
          <dl className="m-0 flex flex-col text-sm">
            {[
              ["Rent, 1 year", rent],
              ["Agency fee", fees.agencyFee],
              ["Legal fee", fees.legalFee],
              ["Caution deposit", fees.cautionDeposit],
              ["Service charge", fees.serviceCharge],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3 border-b border-dashed border-line py-2">
                <dt>{k}</dt>
                <dd className="m-0 font-mono">{naira(v as number)}</dd>
              </div>
            ))}
          </dl>
          <div className="h-0.5 bg-ink" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Total to move in</span>
            <span className="font-mono text-[28px] font-medium leading-8">{naira(total)}</span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/* ---------- Step 5: drag-to-reorder photos, the first is the cover ---------- */

function StepPhotos({ s, set, errors }: StepProps) {
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(s.images);
  imagesRef.current = s.images;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    const room = 15 - s.images.length;
    const list = [...files].slice(0, room);
    if (files.length > room) setUploadError(`You can add ${room} more ${room === 1 ? "photo" : "photos"}; the rest were skipped.`);
    setUploading(list.length);
    for (const f of list) {
      try {
        const url = await uploadFile("listing", f);
        imagesRef.current = [...imagesRef.current, url];
        set({ images: imagesRef.current });
      } catch (e) {
        setUploadError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= s.images.length || from === to) return;
    const next = [...s.images];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    set({ images: next });
  };

  return (
    <Section
      title="Photos"
      lead={
        <>
          Add <span className="font-mono">4</span> to <span className="font-mono">15</span> photos. Drag to reorder; the first one is the cover. No watermarks, text overlays or collages, please.
        </>
      }
    >
      <div
        className="flex flex-col items-center gap-3 rounded-[10px] border-2 border-dashed border-line bg-paper px-4 py-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (drag == null) add(e.dataTransfer.files);
        }}
      >
        <Icon n="upload" size={28} />
        <p className="m-0 text-[15px]">Drop photos here, or</p>
        <Button type="button" variant="tertiary" onClick={() => input.current?.click()} disabled={s.images.length >= 15}>
          Choose photos
        </Button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        <span className="text-[13px] text-muted">JPG, PNG, WebP or HEIC, up to 10 MB each.</span>
      </div>
      {uploadError || errors.images ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {uploadError ?? errors.images}
        </p>
      ) : null}
      <p className="m-0 text-sm text-muted" aria-live="polite">
        <span className="font-mono">{s.images.length}</span> of 15 photos{uploading ? `, uploading ${uploading}…` : ""}
      </p>
      {s.images.length ? (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
          {s.images.map((url, i) => (
            <li
              key={url}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (drag != null && drag !== i) {
                  move(drag, i);
                  setDrag(i);
                }
              }}
              onDragEnd={() => setDrag(null)}
              className={cx("group relative aspect-[4/3] cursor-grab overflow-hidden rounded-[10px] border bg-surface", drag === i ? "border-green opacity-60" : "border-line")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(url, 480, 360)} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" draggable={false} />
              {i === 0 ? <span className="label-caps absolute left-2 top-2 rounded-full bg-ink px-2 py-1 !text-[11px] text-white">Cover</span> : null}
              <div className="absolute inset-x-2 bottom-2 flex justify-between">
                <div className="flex gap-1">
                  <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, i - 1)} className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface/95 disabled:opacity-40">
                    <Icon n="left" size={16} />
                  </button>
                  <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={i === s.images.length - 1} onClick={() => move(i, i + 1)} className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface/95 disabled:opacity-40">
                    <Icon n="right" size={16} />
                  </button>
                </div>
                <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => set({ images: s.images.filter((x) => x !== url) })} className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface/95 text-danger">
                  <Icon n="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

/* ---------- Step 6 ---------- */

function StepReview({ s, areas, trusted, status, onEdit }: { s: FormState; areas: AreaOpt[]; trusted: boolean; status: string; onEdit: (n: number) => void }) {
  const area = areas.find((a) => a.id === s.areaId)?.name ?? "—";
  const rent = num(s.price);
  const total =
    s.type === "rent"
      ? totalUpfront(rent, {
          agencyFee: feeAmount({ mode: s.rent.agencyFee.mode, value: num(s.rent.agencyFee.value) }, rent),
          legalFee: feeAmount({ mode: s.rent.legalFee.mode, value: num(s.rent.legalFee.value) }, rent),
          cautionDeposit: feeAmount({ mode: s.rent.cautionDeposit.mode, value: num(s.rent.cautionDeposit.value) }, rent),
          serviceCharge: feeAmount({ mode: s.rent.serviceCharge.mode, value: num(s.rent.serviceCharge.value) }, rent),
        })
      : null;
  const rows: [number, string, ReactNode][] = [
    [1, "Title", s.title],
    [1, "Type", `${s.type === "rent" ? "For rent" : s.type === "sale" ? "For sale" : "Shortlet"} · ${PROPERTY_TYPES.find(([v]) => v === s.propertyType)?.[1]}`],
    [2, "Area", `${area}${s.streetName ? ` · ${s.streetName}${s.showStreet ? "" : " (hidden)"}` : ""}`],
    [3, "Specs", `${s.bedrooms} bed · ${s.bathrooms} bath · ${s.toilets} toilets · ${s.parking} parking${s.sizeSqm ? ` · ${s.sizeSqm} m²` : ""}`],
    [3, "Amenities", s.amenities.length ? s.amenities.join(", ") : "None listed"],
    [4, "Price", <span key="p" className="font-mono">{naira(rent)} {priceUnit(s.type)}</span>],
    ...(total != null ? ([[4, "Total to move in", <span key="t" className="font-mono">{naira(total)}</span>]] as [number, string, ReactNode][]) : []),
    [5, "Photos", `${s.images.length} photos`],
  ];
  return (
    <Section
      title="Review and post"
      lead={
        status === "active"
          ? "Your changes go live when you post."
          : trusted
            ? "Your listing goes live on the map as soon as you post it."
            : "Your first three listings are checked by our team, usually within a day. After that, listings go live straight away."
      }
    >
      {s.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(s.images[0], 860, 480)} alt="Cover photo" className="aspect-[16/9] w-full rounded-[10px] object-cover" />
      ) : null}
      <dl className="m-0 flex flex-col">
        {rows.map(([n, k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 border-b border-dashed border-line py-3 last:border-0">
            <dt className="w-36 flex-none text-sm text-muted">{k}</dt>
            <dd className="m-0 flex-1 text-[15px]">{v}</dd>
            <button type="button" onClick={() => onEdit(n)} className="h-8 border-0 bg-transparent text-sm font-semibold text-green">
              Edit
            </button>
          </div>
        ))}
      </dl>
    </Section>
  );
}
