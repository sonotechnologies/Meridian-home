"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PROPERTY_TYPES, PROPERTY_LABEL, TYPE_LABEL, naira, type ListingType, type PropertyType } from "@/lib/format";
import { PRICE_PRESETS, PRICE_RANGE, priceLabel, type Filters } from "@/lib/filters";
import { Icon } from "../icon";
import { chipClass, cx, inputClass } from "../ui";

export type AreaChoice = { slug: string; name: string; count?: number };

/* ---------- Type toggle: three-part segmented control ---------- */

export function TypeToggle({ value, onChange, size = "md" }: { value: ListingType; onChange: (t: ListingType) => void; size?: "md" | "sm" }) {
  return (
    <div role="radiogroup" aria-label="Listing type" className="flex w-max rounded-[6px] border border-line bg-surface p-[3px]">
      {(["rent", "sale", "shortlet"] as const).map((t) => {
        const on = t === value;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t)}
            className={cx(
              "rounded-[4px] border-0 px-4 text-sm font-semibold transition-colors duration-120",
              size === "sm" ? "h-[34px] px-3" : "h-[38px]",
              on ? "bg-green text-white" : "bg-transparent text-muted hover:text-ink",
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Popover ---------- */

export function Popover({
  label,
  active,
  children,
  width = 320,
  align = "left",
}: {
  label: ReactNode;
  active?: boolean;
  children: (close: () => void) => ReactNode;
  width?: number;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={chipClass(Boolean(active))}>
        {label}
        <Icon n="down" size={16} />
      </button>
      {open ? (
        <div
          id={id}
          className={cx("animate-rise-in absolute top-12 z-[60] rounded-[10px] border border-line bg-surface p-4 shadow-[var(--shadow-float)]", align === "right" ? "right-0" : "left-0")}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Area ---------- */

export function AreaOptions({ areas, value, onChange }: { areas: AreaChoice[]; value?: string; onChange: (slug?: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Area">
      <button type="button" role="radio" aria-checked={!value} className={chipClass(!value)} onClick={() => onChange(undefined)}>
        All five areas
      </button>
      {areas.map((a) => (
        <button key={a.slug} type="button" role="radio" aria-checked={value === a.slug} className={chipClass(value === a.slug)} onClick={() => onChange(a.slug)}>
          {a.name}
        </button>
      ))}
    </div>
  );
}

/* ---------- Price: two inputs, a slider beneath, presets that change with type ---------- */

export function PriceOptions({
  f,
  onChange,
}: {
  f: Pick<Filters, "type" | "min" | "max" | "basis">;
  onChange: (p: { min?: number; max?: number; basis?: "rent" | "total" }) => void;
}) {
  const range = PRICE_RANGE[f.type];
  const [lo, setLo] = useState(f.min ?? range.min);
  const [hi, setHi] = useState(f.max ?? range.max);
  useEffect(() => {
    setLo(f.min ?? range.min);
    setHi(f.max ?? range.max);
  }, [f.min, f.max, range.min, range.max]);

  const commit = (a: number, b: number) =>
    onChange({ min: a > range.min ? a : undefined, max: b < range.max ? b : undefined });
  const parse = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
  const id = useId();

  return (
    <div className="flex flex-col gap-4">
      {f.type === "rent" ? (
        <div role="radiogroup" aria-label="Price is" className="flex gap-2">
          <button type="button" role="radio" aria-checked={f.basis !== "total"} className={chipClass(f.basis !== "total")} onClick={() => onChange({ basis: "rent", min: f.min, max: f.max })}>
            Yearly rent
          </button>
          <button type="button" role="radio" aria-checked={f.basis === "total"} className={chipClass(f.basis === "total")} onClick={() => onChange({ basis: "total", min: f.min, max: f.max })}>
            Total to move in
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-min`} className="text-sm font-medium">
            Minimum
          </label>
          <input
            id={`${id}-min`}
            inputMode="numeric"
            className={inputClass + " font-mono"}
            value={lo > range.min ? naira(lo) : ""}
            placeholder="No min"
            onChange={(e) => setLo(parse(e.target.value))}
            onBlur={() => commit(Math.min(lo, hi), hi)}
            onKeyDown={(e) => e.key === "Enter" && commit(Math.min(lo, hi), hi)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-max`} className="text-sm font-medium">
            Maximum
          </label>
          <input
            id={`${id}-max`}
            inputMode="numeric"
            className={inputClass + " font-mono"}
            value={hi < range.max ? naira(hi) : ""}
            placeholder="No max"
            onChange={(e) => setHi(parse(e.target.value) || range.max)}
            onBlur={() => commit(lo, Math.max(lo, hi))}
            onKeyDown={(e) => e.key === "Enter" && commit(lo, Math.max(lo, hi))}
          />
        </div>
      </div>
      <DualRange
        min={range.min}
        max={range.max}
        step={range.step}
        lo={lo}
        hi={hi}
        onInput={(a, b) => {
          setLo(a);
          setHi(b);
        }}
        onCommit={commit}
      />
      <div className="flex flex-wrap gap-2">
        {PRICE_PRESETS[f.type].map((p) => {
          const on = f.min === p.min && f.max === p.max;
          return (
            <button key={p.label} type="button" aria-pressed={on} className={chipClass(on)} onClick={() => onChange(on ? {} : { min: p.min, max: p.max })}>
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DualRange({
  min,
  max,
  step,
  lo,
  hi,
  onInput,
  onCommit,
}: {
  min: number;
  max: number;
  step: number;
  lo: number;
  hi: number;
  onInput: (lo: number, hi: number) => void;
  onCommit: (lo: number, hi: number) => void;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const thumb =
    "pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-green [&::-webkit-slider-thumb]:bg-surface [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-green [&::-moz-range-thumb]:bg-surface";
  return (
    <div className="relative h-6">
      <div className="absolute inset-x-0 top-[11px] h-0.5 rounded bg-line" />
      <div className="absolute top-[11px] h-0.5 rounded bg-green" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      <input
        type="range"
        aria-label="Minimum price"
        aria-valuetext={naira(lo)}
        min={min}
        max={max}
        step={step}
        value={lo}
        className={thumb}
        onChange={(e) => onInput(Math.min(Number(e.target.value), hi - step), hi)}
        onPointerUp={() => onCommit(lo, hi)}
        onKeyUp={() => onCommit(lo, hi)}
      />
      <input
        type="range"
        aria-label="Maximum price"
        aria-valuetext={hi >= max ? "No maximum" : naira(hi)}
        min={min}
        max={max}
        step={step}
        value={hi}
        className={thumb}
        onChange={(e) => onInput(lo, Math.max(Number(e.target.value), lo + step))}
        onPointerUp={() => onCommit(lo, hi)}
        onKeyUp={() => onCommit(lo, hi)}
      />
    </div>
  );
}

/* ---------- Home type and bedrooms ---------- */

export function HomeTypeOptions({ value, onChange }: { value?: string[]; onChange: (v?: PropertyType[]) => void }) {
  const set = new Set(value ?? []);
  return (
    <div className="flex flex-wrap gap-2">
      {PROPERTY_TYPES.map(([v, label]) => {
        const on = set.has(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            className={chipClass(on)}
            onClick={() => {
              const next = new Set(set);
              if (on) next.delete(v);
              else next.add(v);
              onChange(next.size ? ([...next] as PropertyType[]) : undefined);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function BedsOptions({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Bedrooms" className="flex flex-wrap gap-2">
      <button type="button" role="radio" aria-checked={!value} className={chipClass(!value)} onClick={() => onChange(undefined)}>
        Any
      </button>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} className={chipClass(value === n)} onClick={() => onChange(n)}>
          {n}+
        </button>
      ))}
    </div>
  );
}

/* ---------- Active filters as removable chips ---------- */

export function ActiveChips({
  f,
  areas,
  onChange,
  onClear,
}: {
  f: Filters;
  areas: AreaChoice[];
  onChange: (p: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const chips: { label: string; remove: () => void }[] = [];
  if (f.area) chips.push({ label: areas.find((a) => a.slug === f.area)?.name ?? f.area, remove: () => onChange({ area: undefined }) });
  const price = priceLabel(f);
  if (price) chips.push({ label: price + (f.type === "rent" && f.basis === "total" ? " total" : ""), remove: () => onChange({ min: undefined, max: undefined }) });
  for (const p of f.ptype ?? []) {
    chips.push({ label: PROPERTY_LABEL[p as PropertyType] ?? p, remove: () => onChange({ ptype: f.ptype!.filter((x) => x !== p) }) });
  }
  if (f.beds) chips.push({ label: `${f.beds}+ beds`, remove: () => onChange({ beds: undefined }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.remove}
          aria-label={`Remove filter: ${c.label}`}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-green bg-green-tint pl-3 pr-2 text-[13px] font-medium text-green"
        >
          {c.label}
          <Icon n="x" size={14} />
        </button>
      ))}
      <button type="button" onClick={onClear} className="h-8 border-0 bg-transparent px-1 text-[13px] font-semibold text-green underline-offset-2 hover:underline">
        Clear filters
      </button>
    </div>
  );
}
