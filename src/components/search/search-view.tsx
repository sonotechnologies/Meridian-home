"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveSearch } from "@/server/actions/buyer";
import { filtersToParams } from "@/lib/filter-params";
import type { Filters } from "@/lib/filters";
import { naira, priceUnit } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import type { ListingSummary } from "@/lib/types";
import { FavouriteButton } from "../favourite-button";
import { Icon } from "../icon";
import { ListingCard, ListingCardSkeleton } from "../listing-card";
import { SearchMap, type MapView } from "../map/search-map";
import { useToast } from "../toast";
import { Button, buttonClass, cx } from "../ui";
import {
  ActiveChips,
  AreaOptions,
  BedsOptions,
  HomeTypeOptions,
  Popover,
  PriceOptions,
  TypeToggle,
  type AreaChoice,
} from "./filters";

type Area = AreaChoice & { lng: number; lat: number; zoom: number };
type Result = { pins: ListingSummary[]; items: ListingSummary[]; total: number; page: number; pageSize: number; truncated: boolean };

const VIEWED_KEY = "meridian:viewed";

function readViewed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 1023px)");
    const on = () => setM(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return m;
}

export function SearchView({
  initialFilters,
  initialResult,
  initialView,
  areas,
  favouriteIds,
}: {
  initialFilters: Filters;
  initialResult: Result;
  initialView?: MapView;
  areas: Area[];
  favouriteIds: string[];
}) {
  const [f, setF] = useState<Filters>(initialFilters);
  const [result, setResult] = useState<Result>(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [view, setView] = useState<MapView | undefined>(initialView);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<(MapView & { key: string }) | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const isMobile = useIsMobile();
  const favs = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const listRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => setViewed(readViewed()), []);

  // Keep the URL in step so a shared link reproduces the same filters and map position.
  useEffect(() => {
    const p = filtersToParams(f);
    if (view) p.set("at", `${view.lat.toFixed(5)},${view.lng.toFixed(5)},${view.zoom.toFixed(2)}`);
    const q = p.toString();
    window.history.replaceState(null, "", q ? `/search?${q}` : "/search");
  }, [f, view]);

  // Refetch after a 300 ms pause whenever filters or the map move.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(false);
      const p = filtersToParams(f);
      p.set("type", f.type);
      if (bbox) p.set("bbox", bbox.join(","));
      try {
        const r = await fetch(`/api/search?${p}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as Result;
        setResult(data);
        setSelectedId((s) => (s && data.pins.some((x) => x.id === s) ? s : null));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [f, bbox, retry]);

  const update = useCallback((p: Partial<Filters>) => {
    setF((cur) => {
      const next = { ...cur, ...p, page: p.page ?? 1 };
      // Price ranges differ per type, so a type switch clears the price filter.
      if (p.type && p.type !== cur.type) {
        next.min = undefined;
        next.max = undefined;
        next.basis = "rent";
      }
      return next;
    });
    if (p.page) listRef.current?.scrollTo({ top: 0 });
  }, []);

  const pickArea = (slug?: string) => {
    update({ area: slug });
    const a = areas.find((x) => x.slug === slug);
    if (a) setFocus({ lng: a.lng, lat: a.lat, zoom: a.zoom, key: `${a.slug}-${Date.now()}` });
  };

  const clear = () => setF((cur) => ({ type: cur.type, sort: cur.sort, basis: "rent", page: 1 }));

  const onMove = useCallback((b: [number, number, number, number], v: MapView) => {
    setBbox(b);
    setView(v);
  }, []);

  const markViewed = (id: string) => {
    const next = new Set(viewed).add(id);
    setViewed(next);
    try {
      localStorage.setItem(VIEWED_KEY, JSON.stringify([...next].slice(-300)));
    } catch {}
  };

  const areaName = areas.find((a) => a.slug === f.area)?.name;
  const empty = !loading && result.total === 0;
  const pages = Math.ceil(result.total / result.pageSize);

  const list = (
    <ResultsList
      f={f}
      result={result}
      loading={loading}
      error={error}
      empty={empty}
      pages={pages}
      areaName={areaName}
      bbox={bbox}
      hoverId={hoverId}
      selectedId={selectedId}
      favs={favs}
      onHover={setHoverId}
      onOpen={markViewed}
      onSort={(sort) => update({ sort })}
      onPage={(page) => update({ page })}
      onClear={clear}
      onRetry={() => setRetry((r) => r + 1)}
      isMobile={isMobile}
    />
  );

  const map = (
    <SearchMap
      pins={result.pins}
      areaLabels={areas}
      initialView={initialView}
      focus={focus}
      hoverId={hoverId}
      selectedId={selectedId}
      viewedIds={viewed}
      loading={loading}
      onHover={setHoverId}
      onSelect={(id) => {
        setSelectedId(id);
        if (id && !isMobile) document.getElementById(`card-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }}
      onMove={onMove}
      isMobile={isMobile}
      bottomInset={isMobile ? SHEET_PEEK : 0}
      renderPreview={(l, placement) => (
        <PreviewCard l={l} placement={placement} fav={favs.has(l.id)} onClose={() => setSelectedId(null)} onOpen={() => markViewed(l.id)} />
      )}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filter bar across the top */}
      <div className="z-20 flex flex-none flex-col gap-3 border-b border-line bg-paper px-4 py-3 lg:px-5">
        <div className="flex items-center gap-2 lg:gap-3">
          <TypeToggle value={f.type} onChange={(type) => update({ type })} size={isMobile ? "sm" : "md"} />
          <div className="hidden items-center gap-2 lg:flex">
            <Popover label={areaName ?? "Area"} active={Boolean(f.area)} width={360}>
              {(close) => (
                <AreaOptions
                  areas={areas}
                  value={f.area}
                  onChange={(s) => {
                    pickArea(s);
                    close();
                  }}
                />
              )}
            </Popover>
            <Popover label="Price" active={f.min != null || f.max != null} width={380}>
              {() => <PriceOptions f={f} onChange={(p) => update(p)} />}
            </Popover>
            <Popover label="Home type" active={Boolean(f.ptype?.length)} width={380}>
              {() => <HomeTypeOptions value={f.ptype} onChange={(ptype) => update({ ptype })} />}
            </Popover>
            <Popover label={f.beds ? `${f.beds}+ beds` : "Bedrooms"} active={Boolean(f.beds)} width={340}>
              {(close) => (
                <BedsOptions
                  value={f.beds}
                  onChange={(beds) => {
                    update({ beds });
                    close();
                  }}
                />
              )}
            </Popover>
          </div>
          <button type="button" onClick={() => setFiltersOpen(true)} className={buttonClass("tertiary", "sm", "ml-auto lg:hidden")}>
            <Icon n="sliders" size={18} />
            Filters
          </button>
        </div>
        <div className="hidden lg:block lg:empty:hidden">
          <ActiveChips f={f} areas={areas} onChange={update} onClear={clear} />
        </div>
      </div>

      {isMobile ? (
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">{map}</div>
          <BottomSheet count={result.total} loading={loading} collapseKey={selectedId}>
            <div ref={listRef}>{list}</div>
          </BottomSheet>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div ref={listRef} className="w-[44%] min-w-[460px] overflow-y-auto border-r border-line" aria-label="Results list">
            {list}
          </div>
          <div className="relative min-w-0 flex-1">{map}</div>
        </div>
      )}

      {filtersOpen ? (
        <FiltersSheet
          initial={f}
          areas={areas}
          bbox={bbox}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            const areaChanged = next.area !== f.area;
            setF({ ...next, page: 1 });
            if (areaChanged) pickArea(next.area);
            setFiltersOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------- List ---------- */

function ResultsList(p: {
  f: Filters;
  result: Result;
  loading: boolean;
  error: boolean;
  empty: boolean;
  pages: number;
  areaName?: string;
  bbox: [number, number, number, number] | null;
  hoverId: string | null;
  selectedId: string | null;
  favs: Set<string>;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  onSort: (s: Filters["sort"]) => void;
  onPage: (n: number) => void;
  onClear: () => void;
  onRetry: () => void;
  isMobile: boolean;
}) {
  const { f, result } = p;
  const from = (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);
  return (
    <div className="flex flex-col">
      <div className={cx("flex items-center justify-between gap-3 px-4 pb-2 lg:px-5", p.isMobile ? "pt-0" : "pt-4")}>
        <h1 className={cx("m-0 text-[17px] font-semibold leading-6", p.isMobile && "sr-only")} aria-live="polite">
          <span className="font-mono">{result.total}</span> {result.total === 1 ? "home" : "homes"} in this area
        </h1>
        <div className="flex items-center gap-2">
          <SaveSearchButton areaName={p.areaName} bbox={p.bbox} compact />
          <label className="flex items-center gap-1 text-sm text-muted">
            <span className="hidden sm:inline">Sort:</span>
            <select
              value={f.sort}
              onChange={(e) => p.onSort(e.target.value as Filters["sort"])}
              className="h-10 cursor-pointer rounded-[6px] border-0 bg-transparent pr-1 text-sm font-medium text-ink"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price, low to high</option>
              <option value="price-desc">Price, high to low</option>
            </select>
          </label>
        </div>
      </div>

      {p.error ? (
        <div className="m-4 flex flex-col items-start gap-3 rounded-[10px] border border-line bg-surface p-5 lg:mx-5">
          <p className="m-0">We couldn’t load homes for this area. Check your connection and try again.</p>
          <Button variant="secondary" size="sm" onClick={p.onRetry}>
            <Icon n="refresh" size={16} />
            Try again
          </Button>
        </div>
      ) : p.empty ? (
        <EmptyState areaName={p.areaName} bbox={p.bbox} onClear={p.onClear} />
      ) : (
        <>
          <ul className="m-0 grid list-none grid-cols-1 gap-4 px-4 pb-4 pt-2 sm:grid-cols-2 lg:px-5" aria-busy={p.loading}>
            {result.items.length === 0 && p.loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <li key={i}>
                    <ListingCardSkeleton />
                  </li>
                ))
              : result.items.map((l, i) => (
                  <li key={l.id} id={`card-${l.id}`} onClickCapture={() => p.onOpen(l.id)}>
                    <ListingCard
                      l={l}
                      priority={i < 4}
                      active={p.hoverId === l.id || p.selectedId === l.id}
                      onEnter={() => p.onHover(l.id)}
                      onLeave={() => p.onHover(null)}
                      fav={<FavouriteButton listingId={l.id} initial={p.favs.has(l.id)} />}
                    />
                  </li>
                ))}
          </ul>
          {p.pages > 1 ? (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3 px-4 pb-8 lg:px-5">
              <span className="text-sm text-muted">
                Showing <span className="font-mono">{from}</span>–<span className="font-mono">{to}</span> of <span className="font-mono">{result.total}</span>
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={result.page <= 1} onClick={() => p.onPage(result.page - 1)}>
                  <Icon n="left" size={16} />
                  Previous
                </Button>
                <Button size="sm" disabled={result.page >= p.pages} onClick={() => p.onPage(result.page + 1)}>
                  Next
                  <Icon n="right" size={16} />
                </Button>
              </div>
            </nav>
          ) : (
            <div className="pb-8" />
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ areaName, bbox, onClear }: { areaName?: string; bbox: [number, number, number, number] | null; onClear: () => void }) {
  return (
    <div className="contour-bg mx-4 my-2 flex flex-col items-center gap-4 rounded-[10px] border border-line px-6 py-14 text-center lg:mx-5">
      <div className="flex flex-col gap-1 rounded-[10px] bg-paper/90 px-4 py-2">
        <h2 className="m-0 font-display text-2xl font-semibold leading-8">No homes match these filters here</h2>
        <p className="m-0 text-[15px] text-muted">Save this search and we’ll email you when one is listed, or widen the filters.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <SaveSearchButton areaName={areaName} bbox={bbox} />
        <Button onClick={onClear}>Clear filters</Button>
      </div>
    </div>
  );
}

function SaveSearchButton({ areaName, bbox, compact }: { areaName?: string; bbox: [number, number, number, number] | null; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();
  return (
    <button
      type="button"
      disabled={pending || saved}
      className={compact ? buttonClass("ghost", "sm", "px-2") : buttonClass("secondary", "md")}
      onClick={() =>
        start(async () => {
          const r = await saveSearch({ query: window.location.search, bbox: bbox?.join(","), areaName });
          if (!r.ok) {
            if (r.needsLogin) router.push(`/login?next=${encodeURIComponent(path + window.location.search)}&reason=search`);
            else toast(r.error ?? "Could not save this search.");
            return;
          }
          setSaved(true);
          toast("Search saved. We’ll email you new matches each morning.");
        })
      }
    >
      <Icon n={saved ? "check" : "bookmark"} size={16} />
      {saved ? "Saved" : compact ? <span className="hidden sm:inline">Save search</span> : "Save this search"}
    </button>
  );
}

/* ---------- Preview card: above the selected pin on desktop, a bottom card on mobile ---------- */

function PreviewCard({
  l,
  placement,
  fav,
  onClose,
  onOpen,
}: {
  l: ListingSummary;
  placement: "above" | "below" | "sheet";
  fav: boolean;
  onClose: () => void;
  onOpen: () => void;
}) {
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const unit = priceUnit(l.type);
  const sheet = placement === "sheet";
  return (
    <div
      className={cx("animate-rise-in overflow-hidden rounded-[10px] border border-line bg-surface shadow-[var(--shadow-float)]", sheet && "flex")}
      style={sheet ? { transform: `translateY(${dy}px)`, transition: startY.current == null ? "transform 240ms ease-out" : "none" } : undefined}
      onPointerDown={sheet ? (e) => (startY.current = e.clientY) : undefined}
      onPointerMove={sheet ? (e) => startY.current != null && setDy(Math.max(0, e.clientY - startY.current)) : undefined}
      onPointerUp={
        sheet
          ? () => {
              startY.current = null;
              if (dy > 60) onClose();
              setDy(0);
            }
          : undefined
      }
    >
      <div className={cx("relative flex-none", sheet ? "w-[38%]" : "h-[140px]")}>
        {l.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(l.cover, 580, 280)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="placeholder-stripes flex h-full w-full items-center justify-center font-mono text-[11px] text-muted">cover photo</div>
        )}
        {!sheet ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface"
          >
            <Icon n="x" size={18} />
          </button>
        ) : null}
        <div className={cx("absolute top-2", sheet ? "left-2" : "right-2")}>
          <FavouriteButton listingId={l.id} initial={fav} />
        </div>
      </div>
      <Link
        href={`/listing/${l.slug}`}
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3 !text-ink no-underline"
      >
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-lg font-medium leading-6">{naira(l.price)}</span>
          {unit ? <span className="text-sm text-muted">{unit}</span> : null}
        </span>
        <span className="truncate text-[15px] font-semibold leading-[22px]">{l.title}</span>
        <span className="text-sm text-muted">
          {l.area}
          {l.beds ? ` · ${l.beds} beds · ${l.baths} baths` : ""}
        </span>
        <span className="mt-1.5 text-[13px] font-semibold text-green">View home</span>
      </Link>
    </div>
  );
}

/* ---------- Mobile bottom sheet: peek (count), half, full ---------- */

const SHEET_PEEK = 96;

function BottomSheet({ count, loading, collapseKey, children }: { count: number; loading: boolean; collapseKey: string | null; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(600);
  const [snap, setSnap] = useState<"peek" | "half" | "full">("peek");
  const [drag, setDrag] = useState<{ start: number; base: number; dy: number } | null>(null);

  useEffect(() => {
    const el = wrap.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Picking a pin drops the sheet to peek so the preview card is visible.
  useEffect(() => {
    if (collapseKey) setSnap("peek");
  }, [collapseKey]);

  const heights = { peek: SHEET_PEEK, half: Math.round(h * 0.5), full: h - 16 };
  const current = drag ? Math.min(heights.full, Math.max(SHEET_PEEK, drag.base - drag.dy)) : heights[snap];

  const end = () => {
    if (!drag) return;
    const v = current;
    const nearest = (Object.entries(heights) as [typeof snap, number][]).reduce((a, b) => (Math.abs(b[1] - v) < Math.abs(a[1] - v) ? b : a));
    setSnap(nearest[0]);
    setDrag(null);
  };

  return (
    <div
      ref={wrap}
      role="region"
      aria-label="Results list"
      className="absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[16px] border-t border-line bg-paper shadow-[0_-8px_24px_rgba(16,34,28,0.16)]"
      style={{ height: current, transition: drag ? "none" : "height 240ms ease-out" }}
    >
      <div
        className="flex flex-none cursor-grab touch-none flex-col items-center gap-2 px-4 pb-2 pt-2.5"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDrag({ start: e.clientY, base: heights[snap], dy: 0 });
        }}
        onPointerMove={(e) => drag && setDrag({ ...drag, dy: e.clientY - drag.start })}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span aria-hidden className="h-1 w-10 rounded-full bg-line" />
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between border-0 bg-transparent p-0 text-left"
          aria-expanded={snap !== "peek"}
          onClick={() => setSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")}
        >
          <span className="text-[17px] font-semibold">
            {loading ? "Loading…" : (
              <>
                <span className="font-mono">{count}</span> {count === 1 ? "home" : "homes"} in this area
              </>
            )}
          </span>
          <Icon n={snap === "full" ? "down" : "up"} size={20} />
        </button>
      </div>
      <div className={cx("min-h-0 flex-1", snap === "peek" && !drag ? "overflow-hidden" : "overflow-y-auto overscroll-contain")}>{children}</div>
    </div>
  );
}

/* ---------- Mobile full-screen filters with "Show N homes" ---------- */

function FiltersSheet({
  initial,
  areas,
  bbox,
  onClose,
  onApply,
}: {
  initial: Filters;
  areas: AreaChoice[];
  bbox: [number, number, number, number] | null;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const [d, setD] = useState<Filters>(initial);
  const [count, setCount] = useState<number | null>(null);
  const set = (p: Partial<Filters>) =>
    setD((cur) => {
      const next = { ...cur, ...p };
      if (p.type && p.type !== cur.type) Object.assign(next, { min: undefined, max: undefined, basis: "rent" });
      return next;
    });

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const p = filtersToParams(d);
      p.set("type", d.type);
      if (bbox && d.area === initial.area) p.set("bbox", bbox.join(","));
      try {
        const r = await fetch(`/api/search?${p}`, { signal: ctrl.signal });
        setCount(((await r.json()) as Result).total);
      } catch {}
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [d, bbox, initial.area]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const section = "flex flex-col gap-3 border-b border-line py-5";
  return (
    <div role="dialog" aria-modal="true" aria-label="Filters" className="animate-rise-in fixed inset-0 z-[100] flex flex-col bg-paper">
      <div className="flex h-14 flex-none items-center justify-between border-b border-line px-4">
        <h2 className="m-0 font-display text-xl font-semibold">Filters</h2>
        <button type="button" onClick={onClose} aria-label="Close filters" className="-mr-2 flex h-11 w-11 items-center justify-center border-0 bg-transparent">
          <Icon n="x" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        <div className={section}>
          <h3 className="m-0 text-base font-semibold">Looking to</h3>
          <TypeToggle value={d.type} onChange={(type) => set({ type })} />
        </div>
        <div className={section}>
          <h3 className="m-0 text-base font-semibold">Area</h3>
          <AreaOptions areas={areas} value={d.area} onChange={(area) => set({ area })} />
        </div>
        <div className={section}>
          <h3 className="m-0 text-base font-semibold">Price</h3>
          <PriceOptions f={d} onChange={(p) => set(p)} />
        </div>
        <div className={section}>
          <h3 className="m-0 text-base font-semibold">Home type</h3>
          <HomeTypeOptions value={d.ptype} onChange={(ptype) => set({ ptype })} />
        </div>
        <div className={cx(section, "border-b-0")}>
          <h3 className="m-0 text-base font-semibold">Bedrooms</h3>
          <BedsOptions value={d.beds} onChange={(beds) => set({ beds })} />
        </div>
      </div>
      <div className="flex flex-none gap-3 border-t border-line bg-paper px-4 py-3">
        <Button onClick={() => setD({ type: d.type, sort: d.sort, basis: "rent", page: 1 })}>Clear</Button>
        <Button variant="secondary" className="flex-1" onClick={() => onApply(d)}>
          {count == null ? "Show homes" : `Show ${count} ${count === 1 ? "home" : "homes"}`}
        </Button>
      </div>
    </div>
  );
}
