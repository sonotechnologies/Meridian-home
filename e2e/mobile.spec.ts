import { expect, test } from "@playwright/test";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://meridian:meridian@localhost:5432/meridian", { max: 1 });
test.afterAll(() => sql.end());

/** Done means: a visitor goes from the landing page to a WhatsApp message in under five taps on mobile. */
test("landing page to WhatsApp in four taps on a phone", async ({ page }) => {
  let taps = 0;
  const tap = async (l: ReturnType<typeof page.locator>) => {
    await l.click();
    taps++;
  };

  let waUrl: string | null = null;
  await page.route("https://wa.me/**", (route) => {
    waUrl = route.request().url();
    return route.fulfill({ status: 200, body: "whatsapp" });
  });

  await page.goto("/");
  await tap(page.getByRole("link", { name: /Lekki \d+ homes?/ }));
  await expect(page).toHaveURL(/\/search\?area=lekki/, { timeout: 30_000 });

  const pin = page.locator("button.pin").first();
  await expect(pin).toBeVisible({ timeout: 20_000 });
  await tap(pin);
  await tap(page.getByRole("link", { name: /View home/ }));
  await expect(page).toHaveURL(/\/listing\//, { timeout: 30_000 });

  // Seeded homes are samples (they show a notice); make this one real for the last tap.
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  const [row] = await sql`select id, agent_id from listings where slug = ${slug}`;
  await sql`update listings set is_demo = false where id = ${row!.id}`;
  await sql`update agent_profiles set is_demo = false where user_id = ${row!.agent_id}`;
  try {
    await tap(page.getByRole("button", { name: "WhatsApp agent" }));
    await expect.poll(() => waUrl, { timeout: 10_000 }).toContain("https://wa.me/234");
    expect(decodeURIComponent(waUrl!)).toContain(`/listing/${slug}`);
    expect(taps).toBeLessThan(5);
    const [lead] = await sql`select channel from leads where listing_id = ${row!.id} order by created_at desc limit 1`;
    expect(lead!.channel).toBe("whatsapp");
  } finally {
    await sql`update listings set is_demo = true where id = ${row!.id}`;
    await sql`update agent_profiles set is_demo = true where user_id = ${row!.agent_id}`;
  }
});
