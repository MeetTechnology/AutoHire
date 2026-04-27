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

async function uploadMaterialFile(
  page: Page,
  categoryName: RegExp,
  name: string,
) {
  const category = page
    .getByRole("button", { name: categoryName })
    .locator("xpath=..");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await category.getByText(/Click to (upload|add) file\(s\)/i).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("sample file content"),
  });
}

async function initializeBrowserSession(page: Page, token: string) {
  const sessionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/expert-session") &&
      response.status() === 200,
  );
  await page.goto(`/apply?t=${token}`);
  await sessionResponse;
}

/** Waits until client `fetchSession` has set `snapshot` (MetaStrip is gated on it). */
async function waitForMaterialsPageSession(page: Page) {
  await expect(
    page.getByRole("heading", {
      name: /Required Documents/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upload by category" }),
  ).toBeVisible();
  await expect(page.getByText("Loading uploaded materials")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Confirm Submission" }),
  ).toBeVisible();
}

async function updateExtractionField(
  page: Page,
  rowName: RegExp,
  value: string,
) {
  const row = page.getByRole("row", { name: rowName });
  await row.getByRole("button").click();
  const input = row.getByRole("textbox");
  await input.fill(value);
  await input.press("Enter");
}

async function confirmExtractedCvInformation(
  page: Page,
  beforeConfirm?: () => Promise<void>,
) {
  await expect(
    page.getByRole("heading", {
      name: /Confirm CV Information/i,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "Key information review" }),
  ).toBeVisible();
  await beforeConfirm?.();
  await page
    .getByRole("button", { name: "Confirm and Start Eligibility Judgment" })
    .click();
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
  test.setTimeout(60_000);
  await page.goto("/apply/resume?t=sample-init-token");

  await expect(
    page.getByRole("heading", {
      name: /CV Upload & Preliminary Assessment/i,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Passport Full Name")).toHaveCount(0);
  await expect(page.getByText("Draft saves automatically")).toHaveCount(0);
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await expect(page.getByText("candidate-eligible.pdf")).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Confirm Upload" }).click();
  await confirmExtractedCvInformation(page);

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
  await uploadMaterialFile(page, /Identity Documents/i, "passport.pdf");
  await expect(page.getByText("passport.pdf")).toBeVisible({ timeout: 30000 });
  await uploadMaterialFile(page, /Education Documents/i, "degree.pdf");
  await expect(page.getByText("degree.pdf")).toBeVisible({ timeout: 30000 });
  await uploadMaterialFile(page, /Employment Documents/i, "employment.pdf");
  await expect(page.getByText("employment.pdf")).toBeVisible({
    timeout: 30000,
  });

  await page.getByRole("button", { name: "Confirm Submission" }).click();
  await expect(
    page.getByText(
      "Application Received! We will review your package and contact you within 1 week.",
    ),
  ).toBeVisible();
});

test("insufficient info flow supports supplemental fields", async ({
  page,
}) => {
  await initializeBrowserSession(page, "sample-progress-token");
  await page.goto("/apply/result?view=additional");
  await expect(page).toHaveURL(/\/apply\/result\?view=additional/);

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

test("eligible review with corrected required contact field can continue to materials", async ({
  page,
}) => {
  await page.goto("/apply/resume?t=sample-init-token");

  await uploadVirtualFile(page, "candidate-contact-missing.pdf");
  await expect(page.getByText("candidate-contact-missing.pdf")).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Confirm Upload" }).click();
  await confirmExtractedCvInformation(page, async () => {
    await updateExtractionField(
      page,
      /Personal EmailRequired/i,
      "taylor.chen@example.com",
    );
  });

  await expect(
    page.getByText("Initial CV review passed", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", {
      name: /Complete your contact details to continue/i,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue to Additional Information" })
    .click();

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
      "Application Received! We will review your package and contact you within 1 week.",
    ),
  ).toBeVisible();
});
