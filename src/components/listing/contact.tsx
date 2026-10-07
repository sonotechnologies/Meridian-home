"use client";

import { useId, useState, useTransition } from "react";
import { requestCallback, startWhatsApp, type FieldErrors } from "@/server/actions/contact";
import { whatsappMessage } from "@/lib/contact-message";
import type { ListingType } from "@/lib/format";
import { Dialog } from "../dialog";
import { Icon } from "../icon";
import { useToast } from "../toast";
import { Button, chipClass, Field, inputClass } from "../ui";

export type ContactListing = {
  slug: string;
  title: string;
  areaName: string | null;
  price: number;
  type: ListingType;
  agentName: string;
  isDemo: boolean;
};

/** "WhatsApp agent" (signal, the one primary button) and "Request a call-back". */
export function ContactButtons({ l, layout }: { l: ContactListing; layout: "stack" | "bar" }) {
  const [modal, setModal] = useState<"wa" | "call" | "demo" | null>(null);
  const [opening, start] = useTransition();
  const toast = useToast();
  const first = l.agentName.split(" ")[0];

  /**
   * Mobile bottom bar: straight to WhatsApp, no preview dialog, so a visitor gets
   * from the landing page to a message in four taps. The lead is logged first.
   */
  const whatsappNow = () =>
    start(async () => {
      const r = await startWhatsApp(l.slug);
      if (!r.ok) return toast(r.error);
      if (r.demo || !r.url) return setModal("demo");
      window.location.href = r.url;
    });
  return (
    <>
      {layout === "stack" ? (
        <div className="flex flex-col gap-2.5">
          <Button variant="primary" size="lg" onClick={() => setModal("wa")}>
            <Icon n="message" size={18} />
            WhatsApp agent
          </Button>
          <Button onClick={() => setModal("call")}>
            <Icon n="phone" size={18} />
            Request a call-back
          </Button>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button onClick={() => setModal("call")} aria-label="Request a call-back" className="w-12 flex-none px-0">
            <Icon n="phone" size={18} />
          </Button>
          <Button variant="primary" size="lg" className="flex-1" disabled={opening} onClick={whatsappNow}>
            <Icon n="message" size={18} />
            WhatsApp agent
          </Button>
        </div>
      )}
      {modal === "wa" ? <WhatsAppDialog l={l} first={first} onClose={() => setModal(null)} /> : null}
      {modal === "demo" ? <SampleNotice onClose={() => setModal(null)} /> : null}
      {modal === "call" ? <CallbackDialog l={l} first={first} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function SampleNotice({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="This is a sample listing" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>OK</Button>}>
      <p className="m-0 text-[15px] leading-[22px]">
        Sample listings show how Meridian works, so WhatsApp won’t open. On a real listing, this message goes straight to the agent’s WhatsApp and the enquiry shows up in their leads.
      </p>
    </Dialog>
  );
}

function WhatsAppDialog({ l, first, onClose }: { l: ContactListing; first: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [demoNotice, setDemoNotice] = useState(false);
  const toast = useToast();
  const message = whatsappMessage(l);

  if (demoNotice) return <SampleNotice onClose={onClose} />;

  return (
    <Dialog
      title={`WhatsApp ${first}`}
      subtitle="We’ll open WhatsApp with this message. Edit it there if you like."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => {
              // Open the tab synchronously so pop-up blockers allow it, then point it at WhatsApp.
              const win = l.isDemo ? null : window.open("about:blank", "_blank");
              start(async () => {
                const r = await startWhatsApp(l.slug);
                if (!r.ok) {
                  win?.close();
                  toast(r.error);
                  return;
                }
                if (r.demo || !r.url) {
                  win?.close();
                  setDemoNotice(true);
                  return;
                }
                if (win) win.location.href = r.url;
                else window.location.href = r.url;
                onClose();
                toast(`Opening WhatsApp with your message to ${first}.`);
              });
            }}
          >
            <Icon n="message" size={18} />
            Open WhatsApp
          </Button>
        </>
      }
    >
      <div className="rounded-[10px_10px_10px_2px] bg-green-tint px-4 py-3.5 text-[15px] leading-[22px]">{message}</div>
    </Dialog>
  );
}

function CallbackDialog({ l, first, onClose }: { l: ContactListing; first: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [time, setTime] = useState<"Morning" | "Afternoon" | "Evening">("Afternoon");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const id = useId();

  const submit = () =>
    start(async () => {
      const r = await requestCallback({ slug: l.slug, name, phone, time, message: message || undefined });
      if (!r.ok) {
        if (r.errors) setErrors(r.errors);
        else toast(r.error ?? "Something went wrong. Try again.");
        return;
      }
      onClose();
      toast(
        r.demo
          ? "Sample listing: no agent will call, but this is how a request reaches them."
          : `Call-back requested for the ${time.toLowerCase()}. ${first} usually calls within 2 hours.`,
      );
    });

  return (
    <Dialog
      title="Request a call-back"
      subtitle={`${first} usually calls back within 2 hours.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={pending} onClick={submit}>
            Request call-back
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <Field id={`${id}-name`} label="Your name" error={errors.name}>
          <input
            id={`${id}-name`}
            className={inputClass}
            value={name}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
          />
        </Field>
        <Field id={`${id}-phone`} label="Phone number" error={errors.phone}>
          <input
            id={`${id}-phone`}
            className={inputClass + " font-mono"}
            value={phone}
            inputMode="tel"
            autoComplete="tel"
            placeholder="0803 000 0000"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((x) => ({ ...x, phone: undefined }));
            }}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" id={`${id}-time`}>
            Best time
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${id}-time`}>
            {(["Morning", "Afternoon", "Evening"] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={time === t} className={chipClass(time === t)} onClick={() => setTime(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <Field id={`${id}-msg`} label="Message (optional)" error={errors.message}>
          <textarea
            id={`${id}-msg`}
            rows={3}
            maxLength={500}
            className={inputClass + " h-auto py-2.5"}
            value={message}
            placeholder={l.type === "shortlet" ? "Dates you have in mind" : "Anything the agent should know"}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
