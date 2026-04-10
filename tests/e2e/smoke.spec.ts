import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("AutoHire Skeleton")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看申请入口" })).toBeVisible();
});
