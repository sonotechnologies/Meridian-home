"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { filtersToParams, PRICE_PRESETS } from "@/lib/filters";
import type { ListingType } from "@/lib/format";
import { Icon } from "../icon";
import { TypeToggle } from "../search/filters";
import { Button } from "../ui";

/** Type toggle, area picker, budget picker and one "Search the map" button. */
export function HeroSearch({ areas }: { areas: { slug: string; name: string }[] }) {
  const [type, setType] = useState<ListingType>("rent");
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");
  const router = useRouter();
  const id = useId();
  const presets = PRICE_PRESETS[type];
  const select =
    "h-12 w-full cursor-pointer appearance-none rounded-[6px] border border-line bg-surface pl-3 pr-9 text-[15px] font-medium text-ink";

  return (
    <form
      role="search"
      className="flex w-full max-w-[560px] flex-col gap-3 rounded-[10px] border border-line bg-surface p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const p = presets[Number(budget)];
        const q = filtersToParams({ type, area: area || undefined, min: budget ? p?.min : undefined, max: budget ? p?.max : undefined });
        router.push(`/search${q.size ? `?${q}` : ""}`);
      }}
    >
      <TypeToggle
        value={type}
        onChange={(t) => {
          setType(t);
          setBudget("");
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-area`} className="relative flex flex-col gap-1">
          <span className="label-caps text-muted">Area</span>
          <select id={`${id}-area`} className={select} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All five areas</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute bottom-3.5 right-3">
            <Icon n="down" size={16} />
          </span>
        </label>
        <label htmlFor={`${id}-budget`} className="relative flex flex-col gap-1">
          <span className="label-caps text-muted">Budget{type === "rent" ? " / year" : type === "shortlet" ? " / night" : ""}</span>
          <select id={`${id}-budget`} className={select + " font-mono"} value={budget} onChange={(e) => setBudget(e.target.value)}>
            <option value="">Any budget</option>
            {presets.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute bottom-3.5 right-3">
            <Icon n="down" size={16} />
          </span>
        </label>
      </div>
      <Button type="submit" variant="secondary" size="lg">
        <Icon n="search" size={18} />
        Search the map
      </Button>
    </form>
  );
}
