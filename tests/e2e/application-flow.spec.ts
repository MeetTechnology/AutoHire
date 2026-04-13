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

function getStartApplicationButton(
  page: Parameters<typeof test>[0]["page"],
) {
  return page.getByRole("button", {
    name: /Start Application|Continue Application/,
  });
}

async function ensureSecondaryAnalysisEditable(
  page: Parameters<typeof test>[0]["page"],
) {
  const editableResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/secondary-analysis/editable"),
  );

  await page.goto("/apply?t=sample-secondary-token");
  await editableResponse.catch(() => undefined);

  const runButton = page.getByRole("button", { name: "Run Detailed Analysis" });
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
  await page.goto("/apply?t=sample-init-token");

  await expect(getStartApplicationButton(page)).toBeVisible();
  await getStartApplicationButton(page).click();

  await expect(
    page.getByRole("heading", { name: /Upload the resume that best represents/ }),
  ).toBeVisible();
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await page.getByRole("button", { name: "Upload and Start Analysis" }).click();

  await expect(
    page.getByText("The initial eligibility review has passed", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Run Detailed Analysis" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Run Detailed Analysis" }).click();
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
  await page
    .getByRole("combobox", { name: /^Highest Degree Required field/ })
    .selectOption({ label: "Doctorate" });
  await page
    .getByRole("textbox", { name: /^Current Employer Required field/ })
    .fill("Example University");
  await page.getByRole("button", { name: "Submit and Reanalyze" }).click();

  await expect(
    page.getByText("The initial eligibility review has passed", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Run Detailed Analysis" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Continue to Materials" }),
  ).toHaveCount(0);
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

  await expect(page.getByRole("combobox", { name: "Highest Degree" })).toHaveValue(
    nextDegree,
  );
  await expect(
    page.getByRole("textbox", { name: "Research Direction" }),
  ).toHaveValue(nextResearchDirection);
  await expect(
    page.getByText(
      "Detailed analysis has already been started for this application.",
    ),
  ).toBeVisible();
});
