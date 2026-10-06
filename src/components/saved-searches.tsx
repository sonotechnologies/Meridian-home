"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSearch, setSearchAlerts } from "@/server/actions/buyer";
import { Icon } from "./icon";
import { useToast } from "./toast";
import { cx } from "./ui";

export type SearchRow = { id: string; name: string; href: string; alertsOn: boolean; hasBounds: boolean; created: string };

export function SavedSearches({ rows }: { rows: SearchRow[] }) {
  const [list, setList] = useState(rows);
  const [, start] = useTransition();
  const toast = useToast();
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {list.map((s) => (
        <li key={s.id} className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link href={s.href} className="truncate text-[15px] font-semibold !text-ink no-underline hover:underline">
              {s.name}
            </Link>
            <span className="text-sm text-muted">
              {s.hasBounds ? "Within the map area you saved · " : ""}Saved {s.created}
            </span>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={s.alertsOn}
              onClick={() => {
                const on = !s.alertsOn;
                setList((l) => l.map((x) => (x.id === s.id ? { ...x, alertsOn: on } : x)));
                start(async () => {
                  const r = await setSearchAlerts(s.id, on);
                  if (!r.ok) setList((l) => l.map((x) => (x.id === s.id ? { ...x, alertsOn: !on } : x)));
                  else toast(on ? "Email alerts on. New matches arrive each morning." : "Email alerts off.");
                });
              }}
              className="flex h-11 items-center gap-2.5 rounded-[6px] border-0 bg-transparent px-2 text-sm font-medium"
            >
              <span className={cx("relative h-6 w-10 rounded-full transition-colors duration-150", s.alertsOn ? "bg-green" : "bg-line")}>
                <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150", s.alertsOn ? "left-[18px]" : "left-0.5")} />
              </span>
              Email alerts
            </button>
            <button
              type="button"
              aria-label={`Delete saved search: ${s.name}`}
              onClick={() =>
                start(async () => {
                  await deleteSearch(s.id);
                  setList((l) => l.filter((x) => x.id !== s.id));
                  toast("Saved search deleted.");
                })
              }
              className="flex h-11 w-11 items-center justify-center rounded-[6px] border-0 bg-transparent text-danger hover:bg-[#fbeceb]"
            >
              <Icon n="trash" size={18} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
