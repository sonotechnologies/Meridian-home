import Link from "next/link";
import type { ReactNode } from "react";
import { naira, priceUnit, TYPE_TAG } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import type { ListingSummary } from "@/lib/types";
import { Icon } from "./icon";
import { cx, SampleTag } from "./ui";

/**
 * 4:3 cover, type tag top left, favourite top right; price in mono, total upfront
 * for rent, title on one line, area, then beds, baths and size.
 */
export function ListingCard({
  l,
  active = false,
  fav,
  onEnter,
  onLeave,
  priority = false,
}: {
  l: ListingSummary;
  active?: boolean;
  fav?: ReactNode;
  onEnter?: () => void;
  onLeave?: () => void;
  priority?: boolean;
}) {
  const unit = priceUnit(l.type);
  const aria = `${l.title}, ${l.area}, ${naira(l.price)}${unit ? " per " + unit.replace("/ ", "") : ""}`;
  return (
    <article
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={cx(
        "group relative flex h-full flex-col overflow-hidden rounded-[10px] border bg-surface transition-colors duration-120",
        active ? "border-green" : "border-line",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {l.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(l.cover, 480, 360)}
            alt={`${l.title}, cover photo`}
            loading={priority ? "eager" : "lazy"}
            width={480}
            height={360}
            className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="placeholder-stripes flex h-full w-full items-center justify-center font-mono text-[11px] font-medium text-muted transition-transform duration-200 ease-out group-hover:scale-[1.03]">
            cover photo 4:3
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <span className="label-caps rounded-full bg-surface px-2 py-1 !text-[11px] text-ink">{TYPE_TAG[l.type]}</span>
          {l.isDemo ? <SampleTag /> : null}
        </div>
        {fav ? <div className="absolute right-2 top-2 z-10">{fav}</div> : null}
      </div>
      <div className="flex flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-lg font-medium leading-6">{naira(l.price)}</span>
          {unit ? <span className="text-sm leading-5 text-muted">{unit}</span> : null}
        </div>
        {l.type === "rent" && l.totalUpfront ? (
          <div className="text-[13px] leading-[18px] text-muted">
            Total to move in <span className="font-mono">{naira(l.totalUpfront)}</span>
          </div>
        ) : null}
        <h3 className="mt-0.5 truncate text-[15px] font-semibold leading-[22px]">
          <Link href={`/listing/${l.slug}`} aria-label={aria} className="!text-ink no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:rounded-[10px] focus-visible:after:outline-2 focus-visible:after:outline-green">
            {l.title}
          </Link>
        </h3>
        <div className="text-sm leading-5 text-muted">{l.area}</div>
        <div className="mt-1.5 flex flex-wrap gap-3.5 text-[13px] leading-[18px]">
          {l.beds > 0 ? (
            <span className="flex items-center gap-[5px]">
              <Icon n="bed" size={16} />
              <span className="sr-only">Bedrooms</span>
              {l.beds}
            </span>
          ) : null}
          {l.baths > 0 ? (
            <span className="flex items-center gap-[5px]">
              <Icon n="bath" size={16} />
              <span className="sr-only">Bathrooms</span>
              {l.baths}
            </span>
          ) : null}
          {l.size ? (
            <span className="flex items-center gap-[5px]">
              <Icon n="size" size={16} />
              <span className="font-mono">{l.size} m²</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface" aria-hidden>
      <div className="aspect-[4/3] animate-pulse bg-line/50" />
      <div className="flex flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="h-5 w-32 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-44 animate-pulse rounded bg-line/40" />
        <div className="h-4 w-full animate-pulse rounded bg-line/60" />
        <div className="h-4 w-24 animate-pulse rounded bg-line/40" />
      </div>
    </div>
  );
}
