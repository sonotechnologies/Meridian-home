import { expect, test } from "@playwright/test";

test("a buyer saves a home and a search, then manages alerts", async ({ page }) => {
  // Signed out: the heart sends you to sign in.
  await page.goto("/search?area=lekki");
  // Wait until the page is interactive (the map only mounts after hydration).
  await expect(page.locator(".maplibregl-canvas")).toBeAttached({ timeout: 20_000 });
  await page.getByRole("button", { name: "Save to favourites" }).first().click();
  await expect(page).toHaveURL(/\/login\?next=.*reason=save/);
  await expect(page.getByText("Sign in to save homes")).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("Tolu Buyer");
  await page.getByLabel("Email").fill(`buyer-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/search\?/);

  // Save the first home in the list.
  const firstCard = page.locator("#main article").first();
  const title = (await firstCard.locator("h3").innerText()).trim();
  await firstCard.getByRole("button", { name: "Save to favourites" }).click();
  await expect(page.getByText("Saved. Find it under Saved homes.")).toBeVisible();
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Save the search.
  await page.goto("/search?type=rent&area=yaba&beds=2");
  await page.getByRole("button", { name: "Save search" }).click();
  await expect(page.getByText(/Search saved/)).toBeVisible();
  await page.goto("/searches");
  const row = page.getByRole("listitem").filter({ hasText: "To rent, in Yaba, 2+ beds" });
  await expect(row).toBeVisible();
  const toggle = row.getByRole("switch", { name: "Email alerts" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "To rent, in Yaba, 2+ beds" }).getByRole("switch")).toHaveAttribute("aria-checked", "false");

  // The saved search link reproduces the filters.
  await page.getByRole("link", { name: "To rent, in Yaba, 2+ beds" }).click();
  await expect(page).toHaveURL(/area=yaba/);
  await expect(page).toHaveURL(/beds=2/);
  await expect(page.getByRole("button", { name: "Remove filter: 2+ beds" })).toBeVisible();

  await page.goto("/searches");
  await page.getByRole("button", { name: /Delete saved search: To rent, in Yaba/ }).click();
  await expect(page.getByText("Saved search deleted.")).toBeVisible();
});

test("cron endpoints need the secret", async ({ request }) => {
  expect((await request.get("/api/cron/expiry")).status()).toBe(401);
  const ok = await request.get("/api/cron/expiry", { headers: { Authorization: "Bearer dev-cron-secret" } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).job).toBe("expiry");
});
