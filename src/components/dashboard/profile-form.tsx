"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { updateProfile } from "@/server/actions/agent";
import { uploadFile } from "@/lib/upload-client";
import { useToast } from "../toast";
import { Avatar, Button, Card, Field, inputClass } from "../ui";

export function ProfileForm({ initial, name, slug }: { initial: { agencyName: string; whatsapp: string; bio: string; photoUrl: string | null }; name: string; slug: string }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();
  const id = useId();
  const local = v.whatsapp.startsWith("+234") ? "0" + v.whatsapp.slice(4) : v.whatsapp;

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} src={v.photoUrl} size={96} />
        <div className="flex flex-col gap-2">
          <Button type="button" size="sm" onClick={() => file.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : v.photoUrl ? "Change photo" : "Add a photo"}
          </Button>
          {v.photoUrl ? (
            <button type="button" className="h-8 border-0 bg-transparent p-0 text-left text-sm text-muted underline" onClick={() => setV({ ...v, photoUrl: null })}>
              Remove photo
            </button>
          ) : null}
          {errors.photoUrl ? <span className="text-[13px] text-danger">{errors.photoUrl}</span> : null}
        </div>
        <input
          ref={file}
          type="file"
          hidden
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploading(true);
            try {
              setV((x) => ({ ...x, photoUrl: null }));
              const url = await uploadFile("agent-photo", f);
              setV((x) => ({ ...x, photoUrl: url }));
            } catch (err) {
              setErrors((x) => ({ ...x, photoUrl: (err as Error).message }));
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateProfile({ agencyName: v.agencyName, whatsapp: v.whatsapp, bio: v.bio, photoUrl: v.photoUrl });
            if (!r.ok) return setErrors(r.errors ?? { form: r.error ?? "Could not save." });
            setErrors({});
            toast("Profile saved.");
            router.refresh();
          });
        }}
      >
        <Field id={`${id}-agency`} label="Agency" error={errors.agencyName}>
          <input id={`${id}-agency`} className={inputClass} value={v.agencyName} onChange={(e) => setV({ ...v, agencyName: e.target.value })} />
        </Field>
        <Field id={`${id}-wa`} label="WhatsApp number" hint="Buyers’ messages open a chat with this number." error={errors.whatsapp}>
          <input id={`${id}-wa`} type="tel" inputMode="tel" className={inputClass + " font-mono"} value={local} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} aria-invalid={Boolean(errors.whatsapp)} />
        </Field>
        <Field id={`${id}-bio`} label="Bio" hint="Which areas you cover and how long you’ve worked there. Up to 600 characters." error={errors.bio}>
          <textarea id={`${id}-bio`} rows={5} maxLength={600} className={inputClass + " h-auto py-2.5 leading-6"} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="secondary" disabled={pending || uploading}>
            Save profile
          </Button>
          <Link href={`/agents/${slug}`} className="text-sm font-semibold">
            See your public profile
          </Link>
        </div>
      </form>
    </Card>
  );
}
