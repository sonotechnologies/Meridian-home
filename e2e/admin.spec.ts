import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://meridian:meridian@localhost:5432/meridian", { max: 1 });
test.afterAll(() => sql.end());

/** Admins are set in the database (see scripts/make-admin.ts). */
async function signInAsNewAdmin(page: Page) {
  const email = `admin-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Ada Admin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/", { timeout: 30_000 });
  await sql`update users set role = 'admin' where email = ${email}`;
  // The role is cached in the session cookie, so sign in again to pick it up.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: 30_000 });
}

test("an admin approves one application, rejects another with a reason, and approves a listing", async ({ page }) => {
  // Put the two sample applications and listings back in the queue.
  await sql`update agent_profiles set status = 'pending', decided_at = null, rejection_reason = null where user_id in ('demo_applicant_1', 'demo_applicant_2')`;
  await sql`update users set role = 'buyer' where id in ('demo_applicant_1', 'demo_applicant_2')`;
  await sql`update listings set status = 'pending', published_at = null where title in ('2 bedroom flat awaiting review', 'Half plot, Governor''s Consent')`;

  await signInAsNewAdmin(page);
  await page.goto("/admin/agents");
  await page.getByRole("link", { name: /Chinedu Obi/ }).click();
  await expect(page.getByRole("heading", { name: "Chinedu Obi" })).toBeVisible();
  await expect(page.getByText("RC 1234567")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. They’re now a verified agent.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Chinedu Obi/ })).toHaveCount(0);

  await page.getByRole("link", { name: /Funke Adeyemi/ }).click();
  await page.getByRole("button", { name: "Reject" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Too short");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(dialog.getByText(/at least 10 characters/)).toBeVisible();
  await dialog.getByLabel("Reason").fill("The ID photo is blurred. Upload a clearer one.");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Rejected. We’ve emailed the reason.")).toBeVisible();

  const [chinedu] = await sql`select role from users where id = 'demo_applicant_1'`;
  expect(chinedu!.role).toBe("agent");
  const [funke] = await sql`select status, rejection_reason from agent_profiles where user_id = 'demo_applicant_2'`;
  expect(funke).toMatchObject({ status: "rejected", rejection_reason: "The ID photo is blurred. Upload a clearer one." });

  // Listing queue: approve, and it appears on the public page.
  await page.goto("/admin/listings");
  await page.getByRole("link", { name: /2 bedroom flat awaiting review/ }).click();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved. It’s on the map for 30 days.")).toBeVisible();
  const [l] = await sql`select slug, status from listings where title = '2 bedroom flat awaiting review'`;
  expect(l!.status).toBe("active");
  await page.goto(`/listing/${l!.slug}`);
  await expect(page.getByRole("heading", { name: "2 bedroom flat awaiting review" })).toBeVisible();
});

test("non-admins can't reach the admin pages", async ({ page }) => {
  await page.goto("/admin/agents");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/for-agents");
  await page.getByRole("button", { name: "Try the agent dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin/listings");
  await expect(page).toHaveURL(/denied=1/);
});
