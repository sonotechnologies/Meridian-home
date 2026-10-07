import { and, count, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { agentProfiles, listings } from "@/db/schema";
import { SideNav, TabBar, type NavItem } from "@/components/dashboard/nav";
import { Header } from "@/components/header";
import { getUser } from "@/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin/agents");
  if (user.role !== "admin" || user.suspended) redirect("/?denied=1");
  const [[a], [l]] = await Promise.all([
    db.select({ n: count() }).from(agentProfiles).where(eq(agentProfiles.status, "pending")),
    db
      .select({ n: count() })
      .from(listings)
      .where(or(and(eq(listings.status, "pending"), eq(listings.sandbox, false)), eq(listings.hiddenByReports, true))),
  ]);
  const items: NavItem[] = [
    { href: "/admin/agents", label: "Agents", icon: "shield", badge: a?.n || undefined },
    { href: "/admin/listings", label: "Listings", icon: "list", badge: l?.n || undefined },
    { href: "/admin/areas", label: "Areas", icon: "map" },
  ];
  return (
    <>
      <Header />
      <div className="flex min-h-[calc(100dvh-64px)]">
        <SideNav items={items} root="/admin" />
        <main id="main" className="min-w-0 flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <TabBar items={items} root="/admin" />
    </>
  );
}
