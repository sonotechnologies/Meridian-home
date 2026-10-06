import Link from "next/link";
import { getUser } from "@/server/session";
import { AccountMenu } from "./account-menu";
import { Logo, ButtonLink } from "./ui";

/** 64 px desktop, 56 px mobile; logo left, "List a property" and account right. */
export async function Header({ back }: { back?: { href: string; label: string } }) {
  const user = await getUser();
  const listHref = user?.role === "agent" ? "/dashboard/listings/new" : "/for-agents";
  return (
    <header className="sticky top-0 z-50 flex h-14 flex-none items-center justify-between border-b border-line bg-paper px-4 sm:h-16 sm:px-6">
      <div className="flex items-center gap-5">
        <Link href="/" aria-label="Meridian home" className="no-underline">
          <Logo />
        </Link>
        {back ? (
          <Link href={back.href} className="hidden h-11 items-center gap-1 px-1 text-sm font-medium no-underline sm:flex">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {back.label}
          </Link>
        ) : null}
      </div>
      <nav aria-label="Account" className="flex items-center gap-3">
        <ButtonLink href={listHref} variant="tertiary" size="sm" className="hidden sm:inline-flex">
          List a property
        </ButtonLink>
        {user ? (
          <AccountMenu name={user.name} role={user.role} />
        ) : (
          <ButtonLink href="/login" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
        )}
      </nav>
    </header>
  );
}
