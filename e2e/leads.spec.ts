import { expect, test } from "@playwright/test";

test("a visitor's call-back request reaches the agent's lead tracker", async ({ page, browser }) => {
  const name = `Kemi ${Date.now()}`;
  await page.goto("/listing/3-bedroom-apartment-with-bq-lekki");
  await page.locator("aside").getByRole("button", { name: "Request a call-back" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your name").fill(name);
  await dialog.getByLabel("Phone number").fill("0803 412 7781");
  await dialog.getByRole("radio", { name: "Evening" }).click();
  await dialog.getByLabel("Message (optional)").fill("Is parking covered?");
  await dialog.getByRole("button", { name: "Request call-back" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Sample listing|Call-back requested/ })).toBeVisible();

  // The demo agent sees it, with the phone number and best time.
  const agent = await browser.newPage();
  await agent.goto("/for-agents");
  await agent.getByRole("button", { name: "Try the agent dashboard" }).click();
  await expect(agent).toHaveURL(/\/dashboard$/);
  await agent.goto("/dashboard/leads");
  const card = agent.getByRole("listitem").filter({ hasText: name });
  await expect(card).toBeVisible();
  await expect(card.getByText("0803 412 7781")).toBeVisible();
  await expect(card.getByText(/Best time: evening/)).toBeVisible();
  await card.getByRole("combobox").selectOption("viewing");
  await agent.reload();
  await expect(agent.getByRole("listitem").filter({ hasText: name }).getByRole("combobox")).toHaveValue("viewing");
});

test("WhatsApp on a sample listing logs the lead and shows a notice instead of opening WhatsApp", async ({ page }) => {
  await page.goto("/listing/3-bedroom-apartment-with-bq-lekki");
  await page.locator("aside").getByRole("button", { name: "WhatsApp agent" }).click();
  await expect(page.getByRole("dialog")).toContainText("Hello Adaeze, I saw the 3 bedroom apartment with BQ in Lekki on Meridian (₦4,500,000 / year)");
  await page.getByRole("dialog").getByRole("button", { name: "Open WhatsApp" }).click();
  await expect(page.getByRole("dialog")).toContainText("This is a sample listing");
});
