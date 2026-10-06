import "server-only";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type Email = { to: string; subject: string; react: ReactElement; text: string };

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** Sent emails are kept in memory when Resend is not configured, so tests and dev can inspect them. */
export const outbox: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  if (!resend) {
    outbox.push(email);
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email stub] to=${email.to} subject="${email.subject}"\n${email.text}`);
    }
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    react: email.react,
    text: email.text,
  });
  if (error) throw new Error(`Email to ${email.to} failed: ${error.message}`);
}
