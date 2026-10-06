import { Header } from "@/components/header";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="contour-bg flex min-h-[calc(100dvh-64px)] items-center justify-center px-4">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-[10px] bg-paper/95 p-8 text-center">
          <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px]">We can’t find that page</h1>
          <p className="m-0 text-muted">The listing may have been taken down, or the link is wrong.</p>
          <ButtonLink href="/search" variant="secondary">
            Search the map
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
