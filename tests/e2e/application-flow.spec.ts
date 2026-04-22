import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function uploadVirtualFile(page: Page, name: string) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from("sample file content"),
    });
}

async function initializeBrowserSession(page: Page, token: string) {
  await page.goto(`/apply?t=${token}`);
}

test("invalid token shows an error", async ({ page }) => {
  await page.goto("/apply?t=bad-token");

  await expect(page.getByText("The invitation link is invalid.")).toBeVisible();
});

test("eligible resume flow can reach materials and submit", async ({
  page,
}) => {
  await initializeBrowserSession(page, "sample-init-token");
  await expect(
    page.getByRole("button", { name: "Next: Upload CV" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next: Upload CV" }).click();

  await expect(
    page.getByRole("heading", {
      name: /Upload your CV and confirm the core identity details/i,
    }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Enter the passport name exactly as shown")
    .fill("E2E Passport Name");
  await page
    .getByPlaceholder("name@example.com")
    .fill("e2e-candidate@example.com");
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await page.getByRole("button", { name: "Submit CV" }).click();

  await expect(
    page.getByText("The initial eligibility review has passed", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: /Start detailed|Start Detailed/i }),
  ).toHaveCount(0);
  await expect(page.getByText("Detailed review")).toHaveCount(0);
  await page.getByRole("link", { name: /Additional Information/i }).click();

  await expect(
    page.getByRole("heading", {
      name: /Complete the final package and confirm submission/,
    }),
  ).toBeVisible();
  await uploadVirtualFile(page, "passport.pdf");
  await expect(page.getByText("passport.pdf")).toBeVisible({ timeout: 10000 });

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
    page.getByText("The initial eligibility review has passed", {
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

test("submitted token restores submitted materials page", async ({ page }) => {
  await initializeBrowserSession(page, "sample-submitted-token");
  await page.goto("/apply/materials");

  await expect(
    page.getByRole("heading", {
      name: /Your application package has been received/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We have received your materials and will respond within 1 to 3 business days.",
    ),
  ).toBeVisible();
});
