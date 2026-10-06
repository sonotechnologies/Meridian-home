"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { applyAsAgent } from "@/server/actions/agent";
import { uploadFile } from "@/lib/upload-client";
import { Icon } from "./icon";
import { Button, Field, inputClass } from "./ui";

export function AgentApplication({ defaultName }: { defaultName: string }) {
  const [v, setV] = useState({ fullName: defaultName, agencyName: "", phone: "", whatsapp: "", cacNumber: "" });
  const [idDoc, setIdDoc] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const id = useId();

  const field = (k: keyof typeof v, label: string, opts: { hint?: string; mono?: boolean; type?: string; auto?: string } = {}) => (
    <Field id={`${id}-${k}`} label={label} hint={opts.hint} error={errors[k]}>
      <input
        id={`${id}-${k}`}
        type={opts.type ?? "text"}
        inputMode={opts.type === "tel" ? "tel" : undefined}
        autoComplete={opts.auto}
        className={inputClass + (opts.mono ? " font-mono" : "")}
        value={v[k]}
        onChange={(e) => {
          setV({ ...v, [k]: e.target.value });
          setErrors((x) => ({ ...x, [k]: "" }));
        }}
        aria-invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `${id}-${k}-error` : opts.hint ? `${id}-${k}-hint` : undefined}
      />
    </Field>
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await applyAsAgent({ ...v, cacNumber: v.cacNumber || undefined, idDocument: idDoc?.key ?? "" });
          if (!r.ok) {
            setErrors(r.errors ?? {});
            setFormError(r.error ?? "Check the highlighted fields.");
            return;
          }
          router.refresh();
        });
      }}
    >
      {field("fullName", "Full name", { hint: "As it appears on your ID.", auto: "name" })}
      {field("agencyName", "Agency name", { hint: "Or your own name if you work alone.", auto: "organization" })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("phone", "Phone", { type: "tel", mono: true, auto: "tel" })}
        {field("whatsapp", "WhatsApp number", { type: "tel", mono: true, hint: "Buyers message this number." })}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Government ID</span>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => file.current?.click()} disabled={uploading}>
            <Icon n="upload" size={18} />
            {idDoc ? "Replace" : uploading ? "Uploading…" : "Upload ID"}
          </Button>
          {idDoc ? (
            <span className="flex items-center gap-1.5 text-sm text-green">
              <Icon n="check" size={16} stroke={2} />
              {idDoc.name}
            </span>
          ) : null}
        </div>
        <input
          ref={file}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            setErrors((x) => ({ ...x, idDocument: "" }));
            try {
              setIdDoc({ key: await uploadFile("id-document", f), name: f.name });
            } catch (err) {
              setErrors((x) => ({ ...x, idDocument: (err as Error).message }));
            } finally {
              setUploading(false);
            }
          }}
        />
        {errors.idDocument ? (
          <span className="text-[13px] text-danger">{errors.idDocument}</span>
        ) : (
          <span className="text-[13px] text-muted">NIN slip, driver’s licence, voter’s card or passport. Only our team sees it, and we delete it 30 days after we decide.</span>
        )}
      </div>
      {field("cacNumber", "CAC number (optional)", { mono: true, hint: "RC or BN number, if your agency is registered." })}
      {formError ? (
        <p role="alert" className="m-0 rounded-[6px] border border-danger px-3 py-2.5 text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending || uploading}>
        Send application
      </Button>
    </form>
  );
}
