"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./ui";

export function AccountMenu({ name, role }: { name: string; role: "buyer" | "agent" | "admin" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links: [string, string][] = [
    ...(role === "agent" ? ([["/dashboard", "Dashboard"], ["/dashboard/listings", "My listings"], ["/dashboard/leads", "Leads"]] as [string, string][]) : []),
    ...(role === "admin" ? ([["/admin/agents", "Agent applications"], ["/admin/listings", "Listing queue"], ["/admin/areas", "Areas"]] as [string, string][]) : []),
    ["/saved", "Saved homes"],
    ["/searches", "Saved searches"],
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0"
      >
        <Avatar name={name} size={40} />
      </button>
      {open ? (
        <div role="menu" className="animate-rise-in absolute right-0 top-12 z-[60] flex w-56 flex-col rounded-[10px] border border-line bg-surface py-1.5 shadow-[var(--shadow-float)]">
          <div className="border-b border-line px-4 pb-2 pt-1.5 text-sm">
            <div className="font-semibold">{name}</div>
            <div className="text-[13px] text-muted capitalize">{role}</div>
          </div>
          {links.map(([href, label]) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="flex h-11 items-center px-4 text-[15px] !text-ink no-underline hover:bg-green-tint">
              {label}
            </Link>
          ))}
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              await authClient.signOut();
              setOpen(false);
              router.push("/");
              router.refresh();
            }}
            className="flex h-11 items-center border-0 border-t border-line bg-transparent px-4 text-left text-[15px] hover:bg-green-tint"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
