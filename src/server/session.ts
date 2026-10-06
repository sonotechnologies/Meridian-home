import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

export type Role = "buyer" | "agent" | "admin";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  suspended: boolean;
  isDemo: boolean;
};

/** The signed-in user for this request, or null. Cached per request. */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: Role; suspended?: boolean; isDemo?: boolean };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? "buyer",
    suspended: Boolean(u.suspended),
    isDemo: Boolean(u.isDemo),
  };
});

/** Redirects to /login when signed out, and to / when the role does not match. */
export async function requireRole(role: Role | Role[], next?: string): Promise<CurrentUser> {
  const user = await getUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(user.role) || user.suspended) redirect("/?denied=1");
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function assertRole(role: Role | Role[]): Promise<CurrentUser> {
  const user = await getUser();
  const roles = Array.isArray(role) ? role : [role];
  if (!user || !roles.includes(user.role) || user.suspended) throw new Error("Not allowed");
  return user;
}
