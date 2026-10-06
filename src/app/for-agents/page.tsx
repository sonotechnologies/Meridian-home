import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentProfiles } from "@/db/schema";
import { AgentApplication } from "@/components/agent-application";
import { Header } from "@/components/header";
import { Icon, type IconName } from "@/components/icon";
import { Footer } from "@/components/footer";
import { Button, ButtonLink, Card, StatusBadge } from "@/components/ui";
import { env } from "@/lib/env";
import { tryAgentDashboard } from "@/server/actions/demo";
import { getUser } from "@/server/session";

export const metadata: Metadata = {
  title: "For agents",
  description: "Post a listing once and buyers find it by filtering a live map of Lagos. Invite-only for verified agents in Lekki, Ikoyi, Victoria Island, Ikeja and Yaba.",
};

const POINTS: [IconName, string, string][] = [
  ["pin", "Post once, found on the map", "Buyers filter by area, price and bedrooms on a live map. Your listing shows up where the home actually is."],
  ["message", "Leads straight to WhatsApp", "Every enquiry opens WhatsApp with the listing link, and lands in your lead tracker with a status you control."],
  ["shield", "A verified badge buyers trust", "We check every agent’s ID before they post. Verified agents carry the badge on every listing."],
  ["refresh", "Listings that stay current", "Listings expire after 30 days unless you tap “Still available”, so buyers stop calling about homes that are gone."],
];

export default async function ForAgentsPage() {
  const user = await getUser();
  const [profile] = user ? await db.select().from(agentProfiles).where(eq(agentProfiles.userId, user.id)).limit(1) : [];

  return (
    <>
      <Header />
      <main id="main">
        <section className="contour-bg border-b border-line">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-14 sm:px-8 sm:py-20">
            <span className="label-caps text-green">For agents · Invite-only in five areas</span>
            <h1 className="m-0 max-w-[720px] font-display text-[36px] font-semibold leading-10 [text-wrap:balance] sm:text-[56px] sm:leading-[60px]">
              List a home once. Buyers find it on the map.
            </h1>
            <p className="m-0 max-w-[560px] text-lg text-muted">
              Meridian is opening to verified agents in Lekki, Ikoyi, Victoria Island, Ikeja and Yaba. Apply below; we check your ID, usually within two working days.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="#apply" variant="secondary" size="lg">
                Apply to list
              </ButtonLink>
              {env.DEMO_MODE ? (
                <form action={tryAgentDashboard}>
                  <Button type="submit" size="lg">
                    Try the agent dashboard
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] gap-6 px-4 py-14 sm:grid-cols-2 sm:px-8">
          {POINTS.map(([icon, title, body]) => (
            <div key={title} className="flex gap-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-green-tint text-green">
                <Icon n={icon} />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-lg font-semibold leading-[26px]">{title}</h2>
                <p className="m-0 text-[15px] text-muted">{body}</p>
              </div>
            </div>
          ))}
        </section>

        <section id="apply" className="mx-auto max-w-[640px] scroll-mt-20 px-4 pb-20 sm:px-8">
          <Card className="flex flex-col gap-5 p-6 sm:p-8">
            <h2 className="m-0 font-display text-2xl font-semibold leading-8">Apply to list on Meridian</h2>
            {!user ? (
              <>
                <p className="m-0 text-[15px] text-muted">Create an account first, then come back to this page to apply. It takes about two minutes.</p>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/signup?next=/for-agents%23apply" variant="secondary">
                    Create an account
                  </ButtonLink>
                  <ButtonLink href="/login?next=/for-agents%23apply">Sign in</ButtonLink>
                </div>
              </>
            ) : user.role === "agent" ? (
              <>
                <p className="m-0 text-[15px]">You’re a verified agent.</p>
                <ButtonLink href="/dashboard" variant="secondary">
                  Go to your dashboard
                </ButtonLink>
              </>
            ) : user.role === "admin" ? (
              <p className="m-0 text-[15px] text-muted">Admin accounts can’t apply as agents.</p>
            ) : profile?.status === "pending" ? (
              <div className="flex flex-col gap-3" role="status">
                <StatusBadge status="pending" />
                <p className="m-0 text-[15px]">
                  Thanks, {profile.fullName.split(" ")[0]}. Your application is with us. We’ll email {user.email} when we’ve checked your ID, usually within two working days. Until then you can browse and save homes as a buyer.
                </p>
              </div>
            ) : profile?.status === "suspended" ? (
              <p className="m-0 text-[15px] text-danger">This account is suspended. Email us if you think this is a mistake.</p>
            ) : (
              <>
                {profile?.status === "rejected" ? (
                  <div className="rounded-[6px] border border-danger bg-surface px-4 py-3 text-sm">
                    <p className="m-0 font-semibold text-danger">We couldn’t approve your last application</p>
                    <p className="m-0 mt-1">{profile.rejectionReason}</p>
                  </div>
                ) : null}
                <AgentApplication defaultName={profile?.fullName ?? user.name} />
              </>
            )}
          </Card>
        </section>
      </main>
      <Footer />
    </>
  );
}
