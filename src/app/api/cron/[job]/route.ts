import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runDemoReset, runExpiry, runIdDocumentCleanup, runSearchAlerts } from "@/server/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<unknown>> = {
  alerts: () => runSearchAlerts(),
  expiry: async () => ({ ...(await runExpiry()), ...(await runIdDocumentCleanup()) }),
  "demo-reset": async () => (env.DEMO_MODE ? runDemoReset() : { skipped: "demo mode is off" }),
};

/** Vercel Cron calls these with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const started = Date.now();
  const result = await run();
  return NextResponse.json({ job, ms: Date.now() - started, result });
}
