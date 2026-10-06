import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icon";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------- Logo: wordmark with the thin meridian line through the "i" ---------- */

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="font-display font-semibold text-ink" style={{ fontSize: size, lineHeight: 1 }}>
      mer
      <span className="relative inline-block">
        i
        <span aria-hidden className="absolute left-1/2 -ml-[0.75px] w-[1.5px] bg-green" style={{ top: -4, bottom: -6 }} />
      </span>
      dian
    </span>
  );
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "tertiary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-signal text-white border-transparent hover:brightness-95",
  secondary: "bg-green text-white border-transparent hover:brightness-110",
  tertiary: "bg-surface text-ink border-line hover:bg-green-tint",
  ghost: "bg-transparent text-green border-transparent hover:bg-green-tint",
  danger: "bg-surface text-danger border-danger hover:bg-[#fbeceb]",
};

export function buttonClass(variant: Variant = "tertiary", size: "md" | "lg" | "sm" = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-[6px] border font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed no-underline",
    size === "lg" ? "h-12 px-5 text-[15px]" : size === "sm" ? "h-10 px-3.5 text-sm" : "h-11 px-[18px] text-[15px]",
    variants[variant],
    extra,
  );
}

export function Button({
  variant = "tertiary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: "md" | "lg" | "sm" }) {
  return <button {...rest} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  variant = "tertiary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "md" | "lg" | "sm" }) {
  return <Link {...rest} className={buttonClass(variant, size, cx(className, variant === "primary" || variant === "secondary" ? "!text-white" : variant === "ghost" ? "!text-green" : "!text-ink"))} />;
}

/* ---------- Badges and tags ---------- */

export function VerifiedBadge() {
  return (
    <span className="inline-flex w-max items-center gap-1 rounded-full bg-green-tint py-[3px] pl-1.5 pr-2.5 text-[13px] font-medium leading-[18px] text-green">
      <Icon n="check" size={14} stroke={2} />
      Verified agent
    </span>
  );
}

export function SampleTag() {
  return <span className="rounded-full bg-amber-tint px-2 py-1 text-[11px] font-medium leading-4 text-ink">Sample listing</span>;
}

export type StatusKey = "active" | "pending" | "expiring" | "expired" | "closed" | "rejected" | "draft";
const STATUS: Record<StatusKey, [string, string]> = {
  active: ["Active", "bg-green-tint text-green border-transparent"],
  pending: ["Pending review", "bg-amber-tint text-ink border-transparent"],
  expiring: ["Expiring", "bg-amber-tint text-ink border-transparent"],
  expired: ["Expired", "bg-paper text-muted border-line"],
  closed: ["Closed", "bg-paper text-muted border-line"],
  rejected: ["Rejected", "bg-surface text-danger border-danger"],
  draft: ["Draft", "bg-paper text-muted border-line"],
};

export function StatusBadge({ status, label }: { status: StatusKey; label?: string }) {
  const [text, cls] = STATUS[status];
  return <span className={cx("inline-flex w-max items-center rounded-full border px-2.5 py-0.5 text-[13px] font-medium leading-[18px]", cls)}>{label ?? text}</span>;
}

/* ---------- Avatar ---------- */

export function Avatar({ name, src, size = 48 }: { name: string; src?: string | null; size?: number }) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full bg-green-tint font-semibold text-green"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {ini}
    </span>
  );
}

/* ---------- Photo placeholder (stripes with a mono explainer) ---------- */

export function PhotoPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cx("placeholder-stripes flex items-center justify-center font-mono text-[11px] font-medium leading-4 text-muted", className)}>
      {label}
    </div>
  );
}

/* ---------- Form fields ---------- */

export function Field({
  label,
  hint,
  error,
  id,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="text-[13px] leading-[18px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-[13px] leading-[18px] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-[6px] border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 focus:outline-2 focus:outline-green focus:outline-offset-0 aria-[invalid=true]:border-danger";

export const chipClass = (on: boolean) =>
  cx(
    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150",
    on ? "border-green bg-green-tint text-green" : "border-line bg-surface text-ink hover:bg-green-tint/50",
  );

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-[10px] border border-line bg-surface", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[6px] bg-line/60", className)} />;
}

/** Thin vertical meridian line used as a section divider. */
export function MeridianRule({ className }: { className?: string }) {
  return <div aria-hidden className={cx("mx-auto h-12 w-px bg-green", className)} />;
}
