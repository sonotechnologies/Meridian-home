"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../icon";
import { cx } from "../ui";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };

function isActive(path: string, href: string, root: string) {
  return href === root ? path === href : path.startsWith(href);
}

/** 240 px sidebar on desktop. */
export function SideNav({ items, root, footer }: { items: NavItem[]; root: string; footer?: React.ReactNode }) {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="sticky top-16 hidden h-[calc(100dvh-64px)] w-[240px] flex-none flex-col gap-1 border-r border-line px-3 py-5 lg:flex">
      {items.map((i) => {
        const on = isActive(path, i.href, root);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "flex h-11 items-center gap-3 rounded-[6px] px-3 text-[15px] font-medium no-underline",
              on ? "bg-green-tint !text-green" : "!text-ink hover:bg-green-tint/60",
            )}
          >
            <Icon n={i.icon} />
            <span className="flex-1">{i.label}</span>
            {i.badge ? <span className="rounded-full bg-signal px-2 font-mono text-xs leading-5 text-white">{i.badge}</span> : null}
          </Link>
        );
      })}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </nav>
  );
}

/** Bottom tab bar on mobile. */
export function TabBar({ items, root }: { items: NavItem[]; root: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((i) => {
        const on = isActive(path, i.href, root);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={cx("relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium no-underline", on ? "!text-green" : "!text-muted")}
          >
            <Icon n={i.icon} size={22} />
            {i.label}
            {i.badge ? <span className="absolute right-[calc(50%-22px)] top-2 h-2 w-2 rounded-full bg-signal" aria-label={`${i.badge} new`} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
