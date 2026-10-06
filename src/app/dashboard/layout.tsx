import { and, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { agentProfiles, leads } from "@/db/schema";
import { Header } from "@/components/header";
import { SideNav, TabBar, type NavItem } from "@/components/dashboard/nav";
import { ButtonLink } from "@/components/ui";
import { getUser } from "@/server/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role !== "agent" || user.suspended) {
    // Applicants wait on the For agents page, which shows their pending notice.
    const [p] = await db.select({ status: agentProfiles.status }).from(agentProfiles).where(eq(agentProfiles.userId, user.id)).limit(1);
    redirect(p ? "/for-agents" : user.role === "admin" ? "/admin/agents" : "/for-agents");
  }
  const [{ n }] = await db.select({ n: count() }).from(leads).where(and(eq(leads.agentId, user.id), eq(leads.status, "new")));
  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "home" },
    { href: "/dashboard/listings", label: "Listings", icon: "list" },
    { href: "/dashboard/leads", label: "Leads", icon: "message", badge: n || undefined },
    { href: "/dashboard/profile", label: "Profile", icon: "user" },
  ];
  return (
    <>
      <Header />
      <div className="flex min-h-[calc(100dvh-64px)]">
        <SideNav
          items={items}
          root="/dashboard"
          footer={
            <ButtonLink href="/dashboard/listings/new" variant="secondary" className="w-full">
              Post listing
            </ButtonLink>
          }
        />
        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 lg:pb-12">
          {user.isDemo ? (
            <p className="mb-5 mt-0 rounded-[6px] border border-amber-tint bg-[#FBF3DD] px-4 py-2.5 text-sm">
              You’re in the demo agent account. Changes you make reset each night and never appear in public search.
            </p>
          ) : null}
          {children}
        </main>
      </div>
      <TabBar items={items} root="/dashboard" />
    </>
  );
}
