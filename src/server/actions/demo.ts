"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_AGENT_EMAIL, DEMO_PASSWORD } from "@/lib/demo";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

/** "Try the agent dashboard": signs the visitor in as the demo agent. */
export async function tryAgentDashboard() {
  if (!env.DEMO_MODE) redirect("/for-agents");
  await auth.api.signInEmail({ body: { email: DEMO_AGENT_EMAIL, password: DEMO_PASSWORD }, headers: await headers() });
  redirect("/dashboard");
}
