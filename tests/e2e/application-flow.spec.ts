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

  await expect(page.getByText("无效的邀约链接")).toBeVisible();
});

test("eligible resume flow can reach materials and submit", async ({
  page,
}) => {
  await page.goto("/apply?t=sample-init-token");

  await expect(page.getByRole("button", { name: "开始申请" })).toBeVisible();
  await page.getByRole("button", { name: "开始申请" }).click();

  await expect(page.getByRole("heading", { name: "简历上传" })).toBeVisible();
  await uploadVirtualFile(page, "candidate-eligible.pdf");
  await page.getByRole("button", { name: "上传并开始分析" }).click();

  await expect(
    page.getByText("已通过初步资格判断", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "继续上传证明材料" }).click();

  await expect(
    page.getByRole("heading", { name: "证明材料上传" }),
  ).toBeVisible();
  await uploadVirtualFile(page, "passport.pdf");
  await expect(page.getByText("passport.pdf")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "确认提交" }).click();
  await expect(
    page.getByText("已收到材料信息，将在 1-3 个工作日内答复。"),
  ).toBeVisible();
});

test("insufficient info flow supports supplemental fields", async ({
  page,
}) => {
  await page.goto("/apply?t=sample-progress-token");

  await expect(page.getByText("还缺少部分关键信息")).toBeVisible();
  await page.getByRole("combobox").selectOption({ label: "博士" });
  await page
    .getByRole("textbox", { name: "当前工作单位" })
    .fill("Example University");
  await page.getByRole("button", { name: "确认并重新分析" }).click();

  await expect(
    page.getByText("已通过初步资格判断", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
});

test("submitted token restores submitted materials page", async ({ page }) => {
  await page.goto("/apply?t=sample-submitted-token");

  await expect(
    page.getByRole("heading", { name: "证明材料上传" }),
  ).toBeVisible();
  await expect(
    page.getByText("已收到材料信息，将在 1-3 个工作日内答复。"),
  ).toBeVisible();
});
