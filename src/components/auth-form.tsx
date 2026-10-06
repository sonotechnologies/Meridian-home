"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Field, inputClass } from "./ui";

/** Only same-site relative paths, so ?next= can't send people elsewhere. */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({ mode, next, googleEnabled }: { mode: "login" | "signup"; next?: string; googleEnabled: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = useId();
  const dest = safeNext(next);

  const submit = () =>
    start(async () => {
      const e: typeof errors = {};
      if (mode === "signup" && name.trim().length < 2) e.name = "Enter your name.";
      if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter an email address, like ada@example.com.";
      if (password.length < 8) e.password = "Use at least 8 characters.";
      if (Object.keys(e).length) return setErrors(e);
      setErrors({});
      const r =
        mode === "signup"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim().toLowerCase(), password })
          : await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (r.error) {
        const code = r.error.code ?? "";
        setErrors({
          form:
            code.includes("INVALID_EMAIL_OR_PASSWORD")
              ? "That email and password don’t match. Try again or create an account."
              : code.includes("USER_ALREADY_EXISTS")
                ? "There’s already an account with that email. Sign in instead."
                : (r.error.message ?? "Something went wrong. Try again."),
        });
        return;
      }
      router.push(dest);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      {googleEnabled ? (
        <>
          <Button type="button" size="lg" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: dest })}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {mode === "signup" ? (
          <Field id={`${id}-name`} label="Your name" error={errors.name}>
            <input id={`${id}-name`} className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} />
          </Field>
        ) : null}
        <Field id={`${id}-email`} label="Email" error={errors.email}>
          <input id={`${id}-email`} type="email" className={inputClass} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
        </Field>
        <Field id={`${id}-pw`} label="Password" error={errors.password} hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <input
            id={`${id}-pw`}
            type="password"
            className={inputClass}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? `${id}-pw-error` : `${id}-pw-hint`}
          />
        </Field>
        {errors.form ? (
          <p role="alert" className="m-0 rounded-[6px] border border-danger bg-surface px-3 py-2.5 text-sm text-danger">
            {errors.form}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" size="lg" disabled={pending}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="m-0 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link>
          </>
        ) : (
          <>
            New to Meridian? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
          </>
        )}
      </p>
    </div>
  );
}
