"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { setLeadStatus } from "@/server/actions/leads";
import { Icon } from "../icon";
import { useToast } from "../toast";
import { chipClass, cx } from "../ui";

export type LeadRow = {
  id: string;
  status: "new" | "contacted" | "viewing" | "closed";
  channel: "whatsapp" | "callback";
  name: string | null;
  phone: string | null;
  message: string | null;
  createdAt: string;
  listingTitle: string;
  listingSlug: string;
};

const STATUSES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["viewing", "Viewing booked"],
  ["closed", "Closed"],
] as const;

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function localPhone(p: string) {
  return p.startsWith("+234") ? "0" + p.slice(4).replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : p;
}

export function LeadTracker({ rows }: { rows: LeadRow[] }) {
  const [filter, setFilter] = useState<LeadRow["status"] | "all">("all");
  const [local, setLocal] = useState(rows);
  const [, start] = useTransition();
  const toast = useToast();
  const counts = useMemo(() => Object.fromEntries(STATUSES.map(([s]) => [s, local.filter((r) => r.status === s).length])), [local]);
  const shown = filter === "all" ? local : local.filter((r) => r.status === filter);

  const change = (id: string, status: LeadRow["status"]) => {
    const before = local;
    setLocal((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    start(async () => {
      const r = await setLeadStatus(id, status);
      if (!r.ok) {
        setLocal(before);
        toast("Couldn’t update that lead. Try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Show leads" className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={filter === "all"} className={chipClass(filter === "all")} onClick={() => setFilter("all")}>
          All <span className="font-mono">{local.length}</span>
        </button>
        {STATUSES.map(([s, label]) => (
          <button key={s} type="button" role="radio" aria-checked={filter === s} className={chipClass(filter === s)} onClick={() => setFilter(s)}>
            {label} <span className="font-mono">{counts[s]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="m-0 rounded-[10px] border border-line bg-surface p-6 text-muted">
          {local.length === 0 ? "No leads yet. When a buyer taps WhatsApp or asks for a call-back, it shows up here." : "No leads with this status."}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((l) => (
            <li key={l.id} className={cx("flex flex-col gap-3 rounded-[10px] border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between", l.status === "new" ? "border-green" : "border-line")}>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    <Icon n={l.channel === "whatsapp" ? "message" : "phone"} size={16} />
                    {l.channel === "whatsapp" ? "WhatsApp" : "Call-back request"}
                  </span>
                  · <span>{when(l.createdAt)}</span>
                  {l.status === "new" ? <span className="h-2 w-2 rounded-full bg-signal" aria-label="New" /> : null}
                </div>
                <Link href={`/listing/${l.listingSlug}`} className="truncate text-[15px] font-semibold !text-ink no-underline hover:underline">
                  {l.listingTitle}
                </Link>
                {l.name || l.phone ? (
                  <p className="m-0 text-[15px]">
                    {l.name ?? "Visitor"}
                    {l.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${l.phone}`} className="font-mono">
                          {localPhone(l.phone)}
                        </a>
                        {" · "}
                        <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="m-0 text-sm text-muted">Opened WhatsApp. Their message comes to your WhatsApp directly.</p>
                )}
                {l.message ? <p className="m-0 text-sm text-muted">“{l.message}”</p> : null}
              </div>
              <label className="flex flex-none flex-col gap-1 text-[13px] text-muted">
                Status
                <select
                  value={l.status}
                  onChange={(e) => change(l.id, e.target.value as LeadRow["status"])}
                  className="h-11 rounded-[6px] border border-line bg-surface px-3 text-[15px] text-ink"
                  aria-label={`Status of lead for ${l.listingTitle}`}
                >
                  {STATUSES.map(([s, label]) => (
                    <option key={s} value={s}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
