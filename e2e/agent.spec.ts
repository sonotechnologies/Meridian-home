import { expect, test } from "@playwright/test";
import path from "node:path";

const photos = [1, 2, 3, 4].map((i) => path.join(__dirname, "fixtures", `photo-${i}.png`));

test("demo agent posts a listing through every step, and it stays out of public search", async ({ page, request }) => {
  await page.goto("/for-agents");
  await page.getByRole("button", { name: "Try the agent dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Hello, Adaeze/ })).toBeVisible();

  await page.getByRole("link", { name: "Post listing" }).first().click();
  const title = `E2E 2 bedroom flat ${Date.now()}`;

  // 1. Type and basics
  await page.getByRole("radio", { name: "For rent" }).click();
  await page.getByRole("radio", { name: "Apartment" }).click();
  await page.getByLabel("Title").fill("Flat");
  await page.getByLabel("Description").fill("Too short");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/at least 8 characters/)).toBeVisible();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Quiet street, borehole water, prepaid meter, estate security and parking for one car.");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 2. Location: pick an area; the pin drops at its centre.
  await expect(page.getByRole("heading", { name: "Location" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/listings\/[0-9a-f-]+\/edit\?step=2/);
  await page.getByRole("radio", { name: "Yaba" }).click();
  await expect(page.getByText("Drag the pin to the building. Buyers only see the general area.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 3. Specs
  await expect(page.getByRole("heading", { name: "Specs" })).toBeVisible();
  await page.getByRole("button", { name: "Borehole water" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 4. Price: the total updates live.
  await expect(page.getByRole("heading", { name: "Price" })).toBeVisible();
  await page.getByRole("textbox", { name: "Yearly rent" }).fill("2500000");
  await page.getByRole("textbox", { name: "Caution deposit (refundable)" }).fill("300000");
  await page.getByRole("textbox", { name: "Service charge, 1 year" }).fill("200000");
  await expect(page.getByText("₦3,500,000")).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 5. Photos: fewer than 4 is refused; the first is the cover.
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(photos.slice(0, 2));
  await expect(page.getByText(/^2 of 15 photos$/)).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/Add at least 4 photos/)).toBeVisible();
  await input.setInputFiles(photos.slice(2));
  await expect(page.getByText(/^4 of 15 photos$/)).toBeVisible();
  await expect(page.getByText("Cover", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Move photo 2 earlier" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 6. Review and post
  await expect(page.getByRole("heading", { name: "Review and post" })).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: "Post listing" }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings$/);
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText("Active")).toBeVisible();

  // Demo agents work in a sandbox: never in public search.
  const res = await request.get("/api/search?bbox=3.2,6.35,3.65,6.7");
  const body = await res.json();
  expect(body.pins.map((p: { title: string }) => p.title)).not.toContain(title);
});

test("a buyer applies to be an agent and sees the pending notice", async ({ page }) => {
  const email = `applicant-${Date.now()}@example.com`;
  await page.goto("/signup?next=/for-agents");
  await page.getByLabel("Your name").fill("Bola Ade");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-9");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/for-agents/);

  await page.getByLabel("Full name").fill("Bola Adeyemi");
  await page.getByLabel("Agency name").fill("Harbour Homes");
  await page.getByLabel("Phone", { exact: true }).fill("0803 412 7781");
  await page.getByLabel("WhatsApp number").fill("12345");
  await page.locator('input[type="file"]').setInputFiles(photos[0]!);
  await expect(page.getByText("photo-1.png")).toBeVisible();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText(/11-digit Nigerian number/)).toBeVisible();

  await page.getByLabel("WhatsApp number").fill("0803 412 7781");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("Pending review")).toBeVisible();
  await expect(page.getByText(/Your application is with us/)).toBeVisible();

  // Still a buyer: the dashboard sends them back here.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/for-agents/);
});
