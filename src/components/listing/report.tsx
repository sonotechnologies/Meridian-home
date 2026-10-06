"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { reportListing } from "@/server/actions/contact";
import { Dialog } from "../dialog";
import { Icon } from "../icon";
import { useToast } from "../toast";
import { Button, Field, inputClass } from "../ui";

const REASONS = [
  ["taken", "Already taken"],
  ["fake", "Looks fake"],
  ["wrong-price", "Wrong price"],
  ["wrong-location", "Wrong location"],
  ["other", "Something else"],
] as const;

export function ReportLink({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const id = useId();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-1.5 border-0 bg-transparent p-0 text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
        <Icon n="flag" size={16} />
        Report this listing
      </button>
      {open ? (
        <Dialog
          title="Report this listing"
          subtitle="We review every report. Three reports hide a listing until we check it."
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (!reason) return setError("Pick a reason.");
                  start(async () => {
                    const r = await reportListing({ slug, reason, note: note || undefined });
                    if (!r.ok) return setError(r.error ?? "Could not send the report.");
                    setOpen(false);
                    toast("Thanks. We’ll review this listing.");
                  });
                }}
              >
                Send report
              </Button>
            </>
          }
        >
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0" aria-describedby={error ? `${id}-err` : undefined}>
            <legend className="mb-2 text-sm font-medium">What’s wrong?</legend>
            {REASONS.map(([v, label]) => (
              <label key={v} className="flex h-11 cursor-pointer items-center gap-3 text-[15px]">
                <input
                  type="radio"
                  name={`${id}-reason`}
                  value={v}
                  checked={reason === v}
                  onChange={() => {
                    setReason(v);
                    setError(null);
                  }}
                  className="h-5 w-5 accent-[var(--green)]"
                />
                {label}
              </label>
            ))}
            {error ? (
              <span id={`${id}-err`} className="text-[13px] text-danger">
                {error}
              </span>
            ) : null}
          </fieldset>
          <div className="mt-4">
            <Field id={`${id}-note`} label="Details (optional)">
              <textarea id={`${id}-note`} rows={3} maxLength={500} className={inputClass + " h-auto py-2.5"} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}

/** Marks the listing as viewed, so its pin shows the "already viewed" state on the map. */
export function ViewedMarker({ id }: { id: string }) {
  useEffect(() => {
    try {
      const k = "meridian:viewed";
      const s = new Set<string>(JSON.parse(localStorage.getItem(k) || "[]"));
      s.add(id);
      localStorage.setItem(k, JSON.stringify([...s].slice(-300)));
    } catch {}
  }, [id]);
  return null;
}
