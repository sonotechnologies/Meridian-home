import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Icon } from "@/components/icon";
import { HeroSearch } from "@/components/landing/hero-search";
import { ButtonLink, PhotoPlaceholder } from "@/components/ui";
import { getAreas } from "@/server/search";

export const metadata: Metadata = {
  title: { absolute: "Meridian: find a place in Lagos without the scrolling" },
  description: "Every home in Lekki, Ikoyi, Victoria Island, Ikeja and Yaba on one map, with the full cost to move in shown before you call anyone.",
};

export const revalidate = 300;

// A cropped, live-looking map: pins as on the search page, one in signal.
const PINS: [number, number, string, ("s" | "d")?][] = [
  [22, 26, "₦2.8M"],
  [46, 30, "₦1.8M"],
  [70, 22, "₦3.1M"],
  [40, 80, "₦85M"],
  [64, 82, "₦4.5M", "s"],
  [84, 76, "₦3.5M"],
  [14, 44, "₦950K"],
];
const LABELS: [number, number, string][] = [
  [24, 16, "Yaba"],
  [10, 34, "Ikeja"],
  [44, 70, "Ikoyi"],
  [22, 90, "Victoria Island"],
  [76, 90, "Lekki"],
];

export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [areas, { denied }] = await Promise.all([getAreas(), searchParams]);
  return (
    <>
      <Header />
      <main id="main">
        {denied ? (
          <p role="status" className="m-0 border-b border-line bg-surface px-4 py-3 text-center text-sm">
            You don’t have access to that page.
          </p>
        ) : null}

        {/* Split hero: text and search left, cropped map right */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-12 lg:py-16">
          <div className="flex flex-col gap-5">
            <span className="label-caps text-green">Rent · Buy · Shortlet in Lagos</span>
            <h1 className="m-0 font-display text-[36px] font-semibold leading-10 tracking-[-0.01em] [text-wrap:balance] sm:text-[56px] sm:leading-[60px]">
              Find a place in Lagos without the scrolling
            </h1>
            <p className="m-0 max-w-[460px] text-base leading-6 text-muted sm:text-lg sm:leading-7">
              Every home on one map, with the full cost to move in shown before you call anyone.
            </p>
            <HeroSearch areas={areas} />
          </div>
          <Link
            href="/search"
            aria-label="Open the map"
            className="relative block aspect-[4/3] overflow-hidden rounded-[10px] border border-line bg-paper no-underline lg:aspect-[5/6]"
            style={{ backgroundImage: "url(/basemap.svg)", backgroundSize: "cover", backgroundPosition: "center" }}
          >
            {LABELS.map(([x, y, t]) => (
              <span key={t} className="area-label absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                {t}
              </span>
            ))}
            {PINS.map(([x, y, label, st], i) => (
              <span
                key={label + x}
                aria-hidden
                className="pin hero-pin absolute"
                data-state={st === "s" ? "selected" : undefined}
                style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -100%)${st === "s" ? " scale(1.15)" : ""}`, animationDelay: `${120 + i * 60}ms`, zIndex: st === "s" ? 2 : 1 }}
              >
                <span className="pin-label">{label}</span>
                <span className="pin-tail" />
              </span>
            ))}
            <span className="absolute bottom-3 left-3 rounded-[6px] bg-paper/90 px-2 py-1 font-mono text-[11px] text-muted">6.4474° N · 3.4723° E</span>
          </Link>
        </section>

        {/* Five areas */}
        <section className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pb-14 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 font-display text-2xl font-semibold leading-8">Five areas, mapped street by street</h2>
            <Link href="/search" className="text-[15px] font-semibold">
              Open the full map
            </Link>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {areas.map((a) => (
              <li key={a.slug}>
                <Link href={`/search?area=${a.slug}`} className="group flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface !text-ink no-underline hover:border-green">
                  <PhotoPlaceholder label="street photo" className="aspect-[4/3] transition-transform duration-200 ease-out group-hover:scale-[1.03]" />
                  <span className="flex items-baseline justify-between gap-2 px-3 py-2.5">
                    <span className="text-[15px] font-semibold">{a.name}</span>
                    <span className="text-sm text-muted">
                      <span className="font-mono">{a.count}</span> {a.count === 1 ? "home" : "homes"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-surface">
          <ol className="mx-auto m-0 grid max-w-[1200px] list-none gap-8 px-4 py-12 sm:grid-cols-3 sm:px-8">
            {[
              ["Filter on the map", "Pick an area, budget and bedrooms. Results update as you move the map."],
              ["See the total cost", "Rent, agency fee, legal fee, caution deposit and service charge, added up before you call."],
              ["Message the agent", "Every agent is verified. WhatsApp them directly or ask for a call-back."],
            ].map(([t, b], i) => (
              <li key={t} className="flex flex-col gap-2">
                <span className="font-mono text-sm text-green">0{i + 1}</span>
                <h3 className="m-0 text-lg font-semibold leading-[26px]">{t}</h3>
                <p className="m-0 text-[15px] leading-6 text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Agents band */}
        <section className="contour-bg">
          <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-5 px-4 py-14 sm:flex-row sm:items-center sm:px-8">
            <div className="flex max-w-[560px] flex-col gap-2 rounded-[10px] bg-paper/90 p-1">
              <h2 className="m-0 font-display text-2xl font-semibold leading-8">Are you an agent?</h2>
              <p className="m-0 text-base text-muted">Post listings for free during the beta. Buyers see your verified badge and message you on WhatsApp.</p>
            </div>
            <ButtonLink href="/for-agents" variant="secondary" size="lg">
              For agents
              <Icon n="arrow" size={18} />
            </ButtonLink>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
