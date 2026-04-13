import { expect, test } from "@playwright/test";

async function uploadVirtualFile(
  page: Parameters<typeof test>[0]["page"],
  name: string,
) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from("sample file content"),
    });
}

test("invalid token shows an error", async ({ page }) => {
  await page.goto("/apply?t=bad-token");

  await expect(page.getByText("The invitation link is invalid.")).toBeVisible();
});

test("eligible resume flow can reach materials and submit", async ({
  page,
}) => {
  await page.goto("/apply?t=sample-init-token");

  await expect(page.getByRole("button", { name: "Start Application" })).toBeVisible();
  await page.getByRole("button", { name: "Start Application" }).click();

  await expect(
    page.getByRole("heading", { name: /Upload the resume that best represents/ }),
  ).toBeVisible();
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await page.getByRole("button", { name: "Upload and Start Analysis" }).click();

  await expect(
    page.getByText("The initial eligibility review has passed", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Continue to Materials" }).click();

  await expect(
    page.getByRole("heading", {
      name: /Complete the application package with the supporting evidence/,
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
  await page.goto("/apply?t=sample-progress-token");

  await expect(
    page.getByText("Some required information is still missing"),
  ).toBeVisible();
  await page.getByRole("combobox").selectOption({ label: "Doctorate" });
  await page
    .getByRole("textbox", { name: "Current Employer" })
    .fill("Example University");
  await page.getByRole("button", { name: "Submit and Reanalyze" }).click();

  await expect(
    page.getByText("The initial eligibility review has passed", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
});

test("submitted token restores submitted materials page", async ({ page }) => {
  await page.goto("/apply?t=sample-submitted-token");

  await expect(
    page.getByRole("heading", {
      name: /Complete the application package with the supporting evidence/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "We have received your materials and will respond within 1 to 3 business days.",
    ),
  ).toBeVisible();
});
