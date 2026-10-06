"use client";

import { useEffect, useRef, useState } from "react";
import { imageUrl } from "@/lib/image-url";
import { Icon } from "../icon";
import { cx } from "../ui";

/**
 * Desktop: one large photo with four thumbnails. Mobile: a swipeable strip with
 * a counter. Every photo opens full size in a lightbox. Placeholders stand in
 * until photos are uploaded.
 */
export function Gallery({ images, title, greyed }: { images: string[]; title: string; greyed?: boolean }) {
  const shots = images.length ? images : Array.from({ length: 5 }, () => "");
  const [open, setOpen] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const alt = (i: number) => `${title}, photo ${i + 1} of ${shots.length}`;
  const grey = greyed ? "grayscale opacity-60" : "";

  function Photo({ i, w, h, className }: { i: number; w: number; h: number; className?: string }) {
    const url = shots[i];
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl(url, w, h)} alt={alt(i)} width={w} height={h} loading={i === 0 ? "eager" : "lazy"} className={cx("h-full w-full object-cover", grey, className)} />
    ) : (
      <div className={cx("placeholder-stripes flex h-full w-full items-center justify-center font-mono text-xs font-medium text-muted", grey, className)}>
        photo {i + 1}
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden h-[460px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-[10px] md:grid">
        {shots.slice(0, 5).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open ${alt(i)}`}
            className={cx("relative overflow-hidden border-0 bg-transparent p-0", i === 0 && "col-span-2 row-span-2")}
          >
            <Photo i={i} w={i === 0 ? 1200 : 600} h={i === 0 ? 900 : 450} className="transition-transform duration-200 ease-out hover:scale-[1.03]" />
            {i === 4 && shots.length > 5 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/50 font-mono text-lg text-white">+{shots.length - 5}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Mobile */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={strip}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        >
          {shots.map((_, i) => (
            <button key={i} type="button" onClick={() => setOpen(i)} aria-label={`Open ${alt(i)}`} className="aspect-[4/3] w-full flex-none snap-center border-0 bg-transparent p-0">
              <Photo i={i} w={800} h={600} />
            </button>
          ))}
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-2.5 py-1 font-mono text-xs text-white" aria-live="polite">
          {index + 1} / {shots.length}
        </span>
      </div>

      {open != null ? <Lightbox shots={shots} start={open} alt={alt} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Lightbox({ shots, start, alt, onClose }: { shots: string[]; start: number; alt: (i: number) => string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const prev = () => setI((x) => (x - 1 + shots.length) % shots.length);
  const next = () => setI((x) => (x + 1) % shots.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const url = shots[i];
  const ctl = "flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/10 text-white hover:bg-white/20";
  return (
    <div role="dialog" aria-modal="true" aria-label="Photos" className="fixed inset-0 z-[110] flex flex-col bg-ink">
      <div className="flex h-14 items-center justify-between px-4 text-white">
        <span className="font-mono text-sm">
          {i + 1} / {shots.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close photos" className={ctl} autoFocus>
          <Icon n="x" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
        {url ? (
          // Full image, not cropped.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt(i)} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="placeholder-stripes flex aspect-[4/3] w-full max-w-4xl items-center justify-center font-mono text-sm text-muted">photo {i + 1}</div>
        )}
        <button type="button" onClick={prev} aria-label="Previous photo" className={cx(ctl, "absolute left-4")}>
          <Icon n="left" />
        </button>
        <button type="button" onClick={next} aria-label="Next photo" className={cx(ctl, "absolute right-4")}>
          <Icon n="right" />
        </button>
      </div>
    </div>
  );
}
