"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Dialog } from "../dialog";
import { useToast } from "../toast";
import { Button, Field, inputClass } from "../ui";

type Act = { label: string; variant: "secondary" | "danger" | "tertiary"; run: (reason: string) => Promise<{ ok: boolean; error?: string }>; needsReason?: { title: string; hint: string }; done: string };

/** Approve and Reject (with a required reason, emailed to the agent), fixed at the bottom of the detail pane. */
export function DecisionBar({ actions, next }: { actions: Act[]; next: string }) {
  const [asking, setAsking] = useState<Act | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const id = useId();

  const run = (a: Act, r?: string) =>
    start(async () => {
      const res = await a.run(r ?? "");
      if (!res.ok) {
        if (a.needsReason) setError(res.error ?? "Something went wrong.");
        else toast(res.error ?? "Something went wrong.");
        return;
      }
      setAsking(null);
      setReason("");
      toast(a.done);
      router.push(next);
      router.refresh();
    });

  return (
    <>
      {actions.map((a) => (
        <Button key={a.label} variant={a.variant} disabled={pending} onClick={() => (a.needsReason ? (setAsking(a), setError(null)) : run(a))}>
          {a.label}
        </Button>
      ))}
      {asking?.needsReason ? (
        <Dialog
          title={asking.needsReason.title}
          onClose={() => setAsking(null)}
          footer={
            <>
              <Button onClick={() => setAsking(null)}>Cancel</Button>
              <Button variant="danger" disabled={pending} onClick={() => run(asking, reason)}>
                {asking.label}
              </Button>
            </>
          }
        >
          <Field id={`${id}-r`} label="Reason" hint={asking.needsReason.hint} error={error}>
            <textarea
              id={`${id}-r`}
              rows={4}
              className={inputClass + " h-auto py-2.5 leading-6"}
              value={reason}
              onChange={(e) => (setReason(e.target.value), setError(null))}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-r-error` : `${id}-r-hint`}
            />
          </Field>
        </Dialog>
      ) : null}
    </>
  );
}
