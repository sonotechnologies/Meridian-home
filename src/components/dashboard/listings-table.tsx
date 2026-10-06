"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { closeListing, deleteDraft, renewListing } from "@/server/actions/agent";
import { naira, priceUnit } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import type { AgentListingRow } from "@/server/dashboard";
import { Dialog } from "../dialog";
import { Icon } from "../icon";
import { useToast } from "../toast";
import { Button, buttonClass, StatusBadge } from "../ui";

export function ListingsTable({ rows }: { rows: AgentListingRow[] }) {
  const [closing, setClosing] = useState<AgentListingRow | null>(null);
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[10px] border border-line bg-surface md:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="label-caps px-4 py-3 text-muted">Listing</th>
              <th scope="col" className="label-caps px-4 py-3 text-muted">Status</th>
              <th scope="col" className="label-caps px-4 py-3 text-right text-muted">Views</th>
              <th scope="col" className="label-caps px-4 py-3 text-right text-muted">Leads</th>
              <th scope="col" className="label-caps px-4 py-3 text-right text-muted">Days left</th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Thumb r={r} />
                    <div className="flex min-w-0 flex-col">
                      <Link href={r.status === "draft" ? `/dashboard/listings/${r.id}/edit` : `/listing/${r.slug}`} className="truncate font-semibold !text-ink no-underline hover:underline">
                        {r.title || "Untitled draft"}
                      </Link>
                      <span className="text-sm text-muted">
                        <span className="font-mono">{r.price ? naira(r.price) : "No price yet"}</span> {r.price ? priceUnit(r.type) : ""}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RowStatus r={r} />
                </td>
                <td className="px-4 py-3 text-right font-mono">{r.views}</td>
                <td className="px-4 py-3 text-right font-mono">{r.leads}</td>
                <td className="px-4 py-3 text-right font-mono">{r.daysLeft ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {r.display === "expiring" || r.display === "expired" ? <RenewButton id={r.id} /> : null}
                    <RowMenu r={r} onClose={() => setClosing(r)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: each row becomes a card */}
      <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-3.5">
            <div className="flex gap-3">
              <Thumb r={r} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={r.status === "draft" ? `/dashboard/listings/${r.id}/edit` : `/listing/${r.slug}`} className="truncate font-semibold !text-ink no-underline">
                  {r.title || "Untitled draft"}
                </Link>
                <span className="font-mono text-sm">{r.price ? naira(r.price) : "No price yet"}</span>
                <RowStatus r={r} />
              </div>
              <RowMenu r={r} onClose={() => setClosing(r)} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm text-muted">
              <span>
                <span className="font-mono text-ink">{r.views}</span> views · <span className="font-mono text-ink">{r.leads}</span> leads
                {r.daysLeft != null ? (
                  <>
                    {" "}
                    · <span className="font-mono text-ink">{r.daysLeft}</span> days left
                  </>
                ) : null}
              </span>
              {r.display === "expiring" || r.display === "expired" ? <RenewButton id={r.id} /> : null}
            </div>
          </li>
        ))}
      </ul>

      {closing ? <CloseDialog r={closing} onDone={() => setClosing(null)} /> : null}
    </>
  );
}

function Thumb({ r }: { r: AgentListingRow }) {
  return r.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl(r.cover, 128, 96)} alt="" width={64} height={48} className="h-12 w-16 flex-none rounded-[6px] object-cover" />
  ) : (
    <div className="placeholder-stripes h-12 w-16 flex-none rounded-[6px]" aria-hidden />
  );
}

function RowStatus({ r }: { r: AgentListingRow }) {
  if (r.hiddenByReports) return <StatusBadge status="pending" label="Hidden after reports" />;
  return (
    <span className="flex flex-col gap-1">
      <StatusBadge status={r.display} label={r.display === "draft" ? `Draft · step ${Math.min(r.draftStep, 6)} of 6` : undefined} />
      {r.status === "rejected" && r.rejectionReason ? <span className="max-w-[260px] text-[13px] text-danger">{r.rejectionReason}</span> : null}
    </span>
  );
}

function RenewButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await renewListing(id);
          toast(r.ok ? "Renewed. Live for another 30 days." : (r.error ?? "Could not renew."));
          router.refresh();
        })
      }
    >
      Still available
    </Button>
  );
}

function RowMenu({ r, onClose }: { r: AgentListingRow; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);
  const item = "flex h-11 w-full items-center gap-2.5 border-0 bg-transparent px-4 text-left text-[15px] !text-ink no-underline hover:bg-green-tint";
  const canClose = r.status === "active" || r.status === "pending" || r.status === "expired";
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={`Actions for ${r.title || "draft"}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-11 w-11 items-center justify-center rounded-[6px] border-0 bg-transparent hover:bg-green-tint">
        <Icon n="more" />
      </button>
      {open ? (
        <div role="menu" className="animate-rise-in absolute right-0 top-12 z-30 w-52 rounded-[10px] border border-line bg-surface py-1.5 shadow-[var(--shadow-float)]">
          {r.status !== "draft" ? (
            <Link role="menuitem" href={`/listing/${r.slug}`} className={item}>
              <Icon n="eye" size={18} /> View
            </Link>
          ) : null}
          {r.status !== "closed" ? (
            <Link role="menuitem" href={`/dashboard/listings/${r.id}/edit`} className={item}>
              <Icon n="edit" size={18} /> {r.status === "draft" ? "Continue editing" : "Edit"}
            </Link>
          ) : null}
          {canClose ? (
            <button
              role="menuitem"
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                onClose();
              }}
            >
              <Icon n="x" size={18} /> Close listing
            </button>
          ) : null}
          {r.status === "draft" ? (
            <button
              role="menuitem"
              type="button"
              className={item + " !text-danger"}
              onClick={() =>
                start(async () => {
                  await deleteDraft(r.id);
                  router.refresh();
                })
              }
            >
              <Icon n="trash" size={18} /> Delete draft
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const CLOSE_REASONS = [
  ["meridian", "Let or sold through Meridian"],
  ["elsewhere", "Let or sold elsewhere"],
  ["withdrawn", "Withdrawn"],
] as const;

function CloseDialog({ r, onDone }: { r: AgentListingRow; onDone: () => void }) {
  const [reason, setReason] = useState<(typeof CLOSE_REASONS)[number][0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Dialog
      title="Close this listing"
      subtitle={r.title}
      onClose={onDone}
      footer={
        <>
          <Button onClick={onDone}>Cancel</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!reason) return setError("Pick a reason.");
              start(async () => {
                const res = await closeListing(r.id, reason);
                if (!res.ok) return setError(res.error ?? "Could not close it.");
                toast("Listing closed. It’s off the map.");
                onDone();
                router.refresh();
              });
            }}
          >
            Close listing
          </Button>
        </>
      }
    >
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">Why is it closing?</legend>
        {CLOSE_REASONS.map(([v, label]) => (
          <label key={v} className="flex h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input type="radio" name="close-reason" checked={reason === v} onChange={() => (setReason(v), setError(null))} className="h-5 w-5 accent-[var(--green)]" />
            {label}
          </label>
        ))}
        {error ? <span className="text-[13px] text-danger">{error}</span> : null}
      </fieldset>
    </Dialog>
  );
}

export function EmptyListings() {
  return (
    <div className="contour-bg flex flex-col items-center gap-4 rounded-[10px] border border-line px-6 py-14 text-center">
      <p className="m-0 rounded-[6px] bg-paper/90 px-3 py-1 text-[17px]">You haven’t posted a listing yet.</p>
      <Link href="/dashboard/listings/new" className={buttonClass("secondary", "md", "!text-white")}>
        Post your first listing
      </Link>
    </div>
  );
}
