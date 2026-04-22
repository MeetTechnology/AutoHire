import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function uploadVirtualFile(page: Page, name: string, index = 0) {
  await page
    .locator('input[type="file"]')
    .nth(index)
    .setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from("sample file content"),
    });
}

async function initializeBrowserSession(page: Page, token: string) {
  await page.goto(`/apply?t=${token}`);
}

/** Waits until client `fetchSession` has set `snapshot` (MetaStrip is gated on it). */
async function waitForMaterialsPageSession(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: /Supporting materials/,
    }),
  ).toBeVisible();
  await expect(page.getByText("Application number")).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset-memory");
});

test("invalid token shows an error", async ({ page }) => {
  await page.goto("/apply?t=bad-token");

  await expect(page.getByText("The invitation link is invalid.")).toBeVisible();
});

test("eligible resume flow can reach materials and submit", async ({
  page,
}) => {
  await page.goto("/apply/resume?t=sample-init-token");

  await expect(
    page.getByRole("heading", {
      name: /Upload and track your CV Submission/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Passport Full Name")).toHaveCount(0);
  await expect(page.getByText("Draft saves automatically")).toHaveCount(0);
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await page.getByRole("button", { name: "Submit CV" }).click();

  await expect(
    page.getByText("Initial CV review passed", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: /Start detailed|Start Detailed/i }),
  ).toHaveCount(0);
  await expect(page.getByText("Detailed review")).toHaveCount(0);
  await page.getByRole("link", { name: /Additional Information/i }).click();

  await waitForMaterialsPageSession(page);
  await uploadVirtualFile(page, "passport.pdf");
  await expect(page.getByText("passport.pdf")).toBeVisible({ timeout: 15000 });
  await uploadVirtualFile(page, "degree.pdf", 1);
  await expect(page.getByText("degree.pdf")).toBeVisible({ timeout: 15000 });
  await uploadVirtualFile(page, "employment.pdf", 2);
  await expect(page.getByText("employment.pdf")).toBeVisible({
    timeout: 15000,
  });

  await page.getByRole("button", { name: "Confirm Submission" }).click();
  await expect(
    page.getByText(
      "We have received your materials and will respond within 1 to 3 business days.",
    ),
  ).toBeVisible();
});

test("insufficient info flow supports supplemental fields", async ({
  page,
}) => {
  await initializeBrowserSession(page, "sample-progress-token");
  await page.goto("/apply/result?view=additional");
  await expect(page).toHaveURL(/\/apply\/resume\?view=additional/);

  await expect(
    page.getByText("Some required information is still missing"),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: /Highest Degree/i })
    .selectOption({ label: "Doctorate" });
  await page
    .getByRole("textbox", { name: /Current Employer/i })
    .fill("Example University");
  await page
    .getByRole("button", { name: "Submit Additional Information" })
    .click();

  await expect(
    page.getByText("Initial CV review passed", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: /Start detailed|Start Detailed/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next: Submission Complete" }),
  ).toHaveCount(0);
});

test("eligible review with missing contact fields requires completion before materials", async ({
  page,
}) => {
  await page.goto("/apply/resume?t=sample-init-token");

  await uploadVirtualFile(page, "candidate-contact-missing.pdf");
  await page.getByRole("button", { name: "Submit CV" }).click();

  await expect(
    page.getByRole("heading", {
      name: /Complete your contact details to continue/i,
    }),
  ).toBeVisible({ timeout: 10000 });

  await page.getByRole("textbox", { name: /^Name$/i }).fill("Taylor Chen");
  await page
    .getByRole("textbox", { name: /Personal Email/i })
    .fill("taylor.chen@example.com");
  await page
    .getByRole("textbox", { name: /Phone Number/i })
    .fill("+1 555 010 7000");
  await page.getByRole("button", { name: "Save Contact Details" }).click();

  await waitForMaterialsPageSession(page);
});

test("submitted token restores submitted materials page", async ({ page }) => {
  await page.goto("/apply/materials?t=sample-submitted-token");

  await expect(
    page.getByRole("heading", {
      name: /Submission complete/,
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We have received your materials and will respond within 1 to 3 business days.",
    ),
  ).toBeVisible();
});
