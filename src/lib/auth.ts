import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, rateLimit, session, users, verification } from "@/db/schema";
import { env } from "@/lib/env";

const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const googleEnabled = Boolean(google);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { users, session, account, verification, rateLimit },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: google,
  user: {
    modelName: "users",
    additionalFields: {
      // Role is set by the server only: sign-up always makes a buyer,
      // agent approval and the admin seed change it.
      role: { type: "string", defaultValue: "buyer", input: false },
      suspended: { type: "boolean", defaultValue: false, input: false },
      isDemo: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 },
  },
  // Stored in Postgres: in-memory counters would be per serverless instance on Vercel.
  rateLimit: { enabled: process.env.NODE_ENV === "production", storage: "database", window: 60, max: 100 },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
