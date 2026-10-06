"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavourite } from "@/server/actions/buyer";
import { Icon } from "./icon";
import { useToast } from "./toast";

/** Heart that fills with a small pop. Signed-out visitors are sent to sign in. */
export function FavouriteButton({
  listingId,
  initial,
  variant = "round",
  onChange,
}: {
  listingId: string;
  initial: boolean;
  variant?: "round" | "text";
  onChange?: (saved: boolean) => void;
}) {
  const [saved, setSaved] = useState(initial);
  const [pop, setPop] = useState(0);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();

  function click(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    if (next) setPop((p) => p + 1);
    start(async () => {
      const r = await toggleFavourite(listingId);
      if (!r.ok) {
        setSaved(!next);
        if (r.needsLogin) {
          router.push(`/login?next=${encodeURIComponent(path + window.location.search)}&reason=save`);
          return;
        }
        toast(r.error ?? "Could not save that home. Try again.");
        return;
      }
      setSaved(r.saved);
      onChange?.(r.saved);
      toast(r.saved ? "Saved. Find it under Saved homes." : "Removed from saved homes.");
    });
  }

  if (variant === "text") {
    return (
      <button
        type="button"
        onClick={click}
        aria-pressed={saved}
        disabled={pending}
        className="flex h-11 items-center justify-center gap-1.5 border-0 bg-transparent text-sm font-semibold text-green"
      >
        <span key={pop} className={pop ? "animate-heart-pop" : undefined}>
          <Icon n="heart" size={16} fill={saved} />
        </span>
        {saved ? "Saved" : "Save this home"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved homes" : "Save to favourites"}
      className="flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface text-ink"
    >
      <span key={pop} className={pop ? "animate-heart-pop" : undefined}>
        <Icon n="heart" size={18} fill={saved} />
      </span>
    </button>
  );
}
