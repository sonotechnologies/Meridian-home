import Link from "next/link";
import { Logo } from "./ui";

/** Contour pattern footer. */
export function Footer() {
  const areas = [
    ["lekki", "Lekki"],
    ["ikoyi", "Ikoyi"],
    ["victoria-island", "Victoria Island"],
    ["ikeja", "Ikeja"],
    ["yaba", "Yaba"],
  ];
  return (
    <footer className="contour-bg border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-12 sm:flex-row sm:justify-between sm:px-8">
        <div className="flex max-w-[320px] flex-col gap-3 rounded-[10px] bg-paper/90 p-1">
          <Logo />
          <p className="m-0 text-sm text-muted">Homes to rent, buy or book in Lagos, on a live map. Every price shows the total cost to move in.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-10 rounded-[10px] bg-paper/90 p-1 text-sm">
          <div className="flex flex-col gap-2">
            <span className="label-caps text-muted">Areas</span>
            {areas.map(([slug, name]) => (
              <Link key={slug} href={`/search?area=${slug}`} className="!text-ink no-underline hover:underline">
                {name}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="label-caps text-muted">Meridian</span>
            <Link href="/search" className="!text-ink no-underline hover:underline">Search the map</Link>
            <Link href="/for-agents" className="!text-ink no-underline hover:underline">For agents</Link>
            <Link href="/saved" className="!text-ink no-underline hover:underline">Saved homes</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
