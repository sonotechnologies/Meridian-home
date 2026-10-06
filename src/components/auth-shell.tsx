import type { ReactNode } from "react";
import { Header } from "./header";

/** Centered card on the contour pattern, used by sign-in, sign-up and short forms. */
export function AuthShell({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="contour-bg flex min-h-[calc(100dvh-64px)] items-start justify-center px-4 py-10 sm:items-center">
        <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-[10px] border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px]">{title}</h1>
            {lead ? <p className="m-0 text-[15px] text-muted">{lead}</p> : null}
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
