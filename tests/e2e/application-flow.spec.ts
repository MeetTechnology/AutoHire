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

async function initializeBrowserSession(
  page: Parameters<typeof test>[0]["page"],
  token: string,
) {
  await page.goto(`/apply?t=${token}`);
}

async function ensureSecondaryAnalysisEditable(
  page: Parameters<typeof test>[0]["page"],
) {
  await initializeBrowserSession(page, "sample-progress-token");
  await page.goto("/apply/result");
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

  const runButton = page.getByRole("button", {
    name: "Start Detailed Analysis",
  });
  const saveButton = page.getByRole("button", {
    name: "Save Detailed Analysis Fields",
  });
  const alreadyStarted = page.getByText(
    "Detailed analysis has already been started for this application.",
  );

  if (await runButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/secondary-analysis"),
      ),
      runButton.click(),
    ]);
  } else {
    await expect(alreadyStarted).toBeVisible({ timeout: 10000 });
  }

  await expect(saveButton).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("combobox", { name: "Highest Degree" }),
  ).toBeEnabled({ timeout: 10000 });
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
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await page.getByRole("button", { name: "Submit CV" }).click();

  await expect(
    page.getByText("The initial eligibility review has passed", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Start Detailed Analysis" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Start Detailed Analysis" }).click();
  await page.getByRole("button", { name: "Next: Submission Complete" }).click();

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
  await page.goto("/apply/result");

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
    page.getByRole("button", { name: "Start Detailed Analysis" }),
  ).toBeVisible({ timeout: 10000 });
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

test("secondary analysis fields can be edited, saved, and restored", async ({
  page,
}) => {
  await ensureSecondaryAnalysisEditable(page);

  const degreeField = page.getByRole("combobox", { name: "Highest Degree" });
  const researchDirectionField = page.getByRole("textbox", {
    name: "Research Direction",
  });
  const nextDegree =
    (await degreeField.inputValue()) === "Master's" ? "Doctorate" : "Master's";
  const nextResearchDirection = `Marine biotechnology ${Date.now()}`;

  await degreeField.selectOption({ label: nextDegree });
  await researchDirectionField.fill(nextResearchDirection);
  await page
    .getByRole("button", { name: "Save Detailed Analysis Fields" })
    .click();

  await expect(page.getByText("Detailed analysis fields saved")).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("combobox", { name: "Highest Degree" }),
  ).toHaveValue(nextDegree);
  await expect(
    page.getByRole("textbox", { name: "Research Direction" }),
  ).toHaveValue(nextResearchDirection);
  await expect(
    page.getByText(
      "Detailed analysis has already been started for this application.",
    ),
  ).toBeVisible();
});
