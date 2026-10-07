import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "../ui";

export type QueueItem = { id: string; href: string; title: string; meta: ReactNode; badge?: ReactNode };

/** Queue on the left, the selected item's detail on the right. On mobile the detail replaces the queue. */
export function TwoPane({
  title,
  tabs,
  items,
  selectedId,
  empty,
  detail,
}: {
  title: string;
  tabs?: ReactNode;
  items: QueueItem[];
  selectedId?: string;
  empty: string;
  detail: ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-0">
      <section className={cx("flex w-full flex-col border-r border-line md:w-[340px] md:flex-none", selectedId && "hidden md:flex")} aria-label={`${title} queue`}>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4">
          <h1 className="m-0 font-display text-2xl font-semibold">{title}</h1>
          {tabs}
        </div>
        {items.length === 0 ? (
          <p className="m-0 px-4 py-6 text-[15px] text-muted">{empty}</p>
        ) : (
          <ul className="m-0 flex-1 list-none overflow-y-auto p-0">
            {items.map((i) => (
              <li key={i.id}>
                <Link
                  href={i.href}
                  aria-current={i.id === selectedId ? "true" : undefined}
                  className={cx("flex flex-col gap-1 border-b border-line px-4 py-3 !text-ink no-underline", i.id === selectedId ? "bg-green-tint" : "hover:bg-surface")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{i.title}</span>
                    {i.badge}
                  </span>
                  <span className="text-sm text-muted">{i.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={cx("min-w-0 flex-1 flex-col", selectedId ? "flex" : "hidden md:flex")} aria-label="Selected item">
        {detail}
      </section>
    </div>
  );
}

/** Detail pane body that scrolls, with the action bar fixed at the bottom. */
export function DetailPane({ back, children, actions }: { back: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <Link href={back} className="mb-4 inline-flex h-11 items-center text-sm font-semibold md:hidden">
          ← Back to the queue
        </Link>
        <div className="mx-auto flex max-w-[760px] flex-col gap-6">{children}</div>
      </div>
      {actions ? <div className="flex flex-none flex-wrap justify-end gap-2.5 border-t border-line bg-paper px-5 py-3 sm:px-8">{actions}</div> : null}
    </>
  );
}

export function EmptyDetail({ text }: { text: string }) {
  return (
    <div className="contour-bg flex flex-1 items-center justify-center">
      <p className="m-0 rounded-[6px] bg-paper/90 px-3 py-1 text-muted">{text}</p>
    </div>
  );
}
