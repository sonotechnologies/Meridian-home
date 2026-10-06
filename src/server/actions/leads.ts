"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { assertRole } from "@/server/session";

const input = z.object({ id: z.string().uuid(), status: z.enum(["new", "contacted", "viewing", "closed"]) });

/** The agent marks each lead as new, contacted, viewing booked or closed. */
export async function setLeadStatus(id: string, status: string): Promise<{ ok: boolean }> {
  const user = await assertRole("agent");
  const p = input.safeParse({ id, status });
  if (!p.success) return { ok: false };
  const rows = await db
    .update(leads)
    .set({ status: p.data.status })
    .where(and(eq(leads.id, p.data.id), eq(leads.agentId, user.id)))
    .returning({ id: leads.id });
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard", "layout");
  return { ok: rows.length === 1 };
}
