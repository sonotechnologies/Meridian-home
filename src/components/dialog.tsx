"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icon";
import { cx } from "./ui";

/** Modal dialog: Escape and the backdrop close it, focus moves in and returns on close. */
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const els = [...ref.current.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href]")].filter((el) => !el.hasAttribute("disabled"));
        if (!els.length) return;
        const [a, b] = [els[0]!, els[els.length - 1]!];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className={cx(
          "animate-rise-in flex max-h-[92dvh] w-full flex-col rounded-t-[16px] bg-surface shadow-[var(--shadow-dialog)] sm:rounded-[10px]",
          wide ? "sm:max-w-[640px]" : "sm:max-w-[460px]",
        )}
      >
        <div className="flex justify-between gap-4 px-6 pt-6">
          <div className="flex flex-col gap-1">
            <h2 id={`${id}-t`} className="m-0 font-display text-2xl font-semibold leading-8">
              {title}
            </h2>
            {subtitle ? <span className="text-sm text-muted">{subtitle}</span> : null}
          </div>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="-mr-2.5 -mt-2.5 flex h-11 w-11 flex-none items-center justify-center border-0 bg-transparent">
            <Icon n="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2.5 border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
