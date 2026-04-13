#!/usr/bin/env node
/**
 * 打印一条 ExpertInvitation 的 INSERT SQL（tokenHash 与 hashInviteToken 一致）。
 *
 * 说明（applicationId）:
 * - 每个 invitation.id 最多对应一条 Application（invitationId 唯一）。
 * - 同一明文 token → 同一 tokenHash → ON CONFLICT 时仍是同一条邀请，不会自动换新 Application。
 * - 若要在「链接/token 不变」的前提下得到新的 applicationId，请使用 --reset-application：
 *   会先删除该 token 已关联的 Application 及其子表数据，再执行 INSERT；下次用链接打开流程时会重新 createApplication。
 *
 * 用法:
 *   node scripts/print-test-invitation-sql.mjs <明文token> [invitationId] [expertId] [email]
 *   node scripts/print-test-invitation-sql.mjs <明文token> --reset-application
 *   node scripts/print-test-invitation-sql.mjs <明文token> [invitationId] [expertId] [email] --reset-application
 *
 * 示例:
 *   node scripts/print-test-invitation-sql.mjs my-invite-002
 *   node scripts/print-test-invitation-sql.mjs my-invite-002 invitation_abc expert_abc a@b.com
 *   node scripts/print-test-invitation-sql.mjs my-invite-002 --reset-application
 *
 * 执行 SQL:
 *   node scripts/print-test-invitation-sql.mjs my-invite-002 --reset-application | bunx --bun prisma db execute --stdin
 */

import { createHash, randomBytes } from "node:crypto";

const rawArgs = process.argv.slice(2);
const resetApplication = rawArgs.includes("--reset-application");
const showHelp = rawArgs.includes("--help") || rawArgs.includes("-h");
const positional = rawArgs.filter(
  (a) => a !== "--reset-application" && a !== "--help" && a !== "-h",
);

if (showHelp || positional.length === 0) {
  console.error(
    [
      "用法: node scripts/print-test-invitation-sql.mjs <明文token> [invitationId] [expertId] [email] [--reset-application]",
      "",
      "--reset-application  在写入邀请前删除该 token（tokenHash）已关联的 Application 及子表，便于同一链接获得新的 applicationId。",
      "仅建议在本地/开发库使用；会清除该申请下的简历、分析任务、材料等数据。",
    ].join("\n"),
  );
  process.exit(showHelp ? 0 : 1);
}

const token = positional[0];
const invitationId =
  positional[1] ?? `invitation_${randomBytes(8).toString("hex")}`;
const expertId = positional[2] ?? `expert_${randomBytes(8).toString("hex")}`;
const email = positional[3] ?? "test@example.com";
const tokenHash = createHash("sha256").update(token).digest("hex");

const esc = (s) => s.replace(/'/g, "''");

const applicationDeleteBlock = `
-- 删除该 token 已绑定的 Application 及其子表（外键多为 RESTRICT，顺序敏感）
DELETE FROM "SecondaryAnalysisRun"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "ResumeAnalysisResult"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "SupplementalFieldSubmission"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "ResumeAnalysisJob"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "ResumeFile"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "ApplicationMaterial"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "ApplicationEventLog"
WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "ExpertInvitation" i ON a."invitationId" = i.id
  WHERE i."tokenHash" = '${tokenHash}'
);

DELETE FROM "Application"
WHERE "invitationId" IN (
  SELECT id FROM "ExpertInvitation" WHERE "tokenHash" = '${tokenHash}'
);
`.trim();

console.log(`-- 明文 token: ${token}`);
console.log(`-- 链接: /apply?t=${encodeURIComponent(token)}`);
if (resetApplication) {
  console.log("-- 模式: --reset-application（将删除该 token 已有关联的 Application 及子数据后再写入邀请）");
}
console.log("");

if (resetApplication) {
  console.log("BEGIN;");
  console.log("");
  console.log(applicationDeleteBlock);
  console.log("");
}

console.log(`INSERT INTO "ExpertInvitation" (
  "id", "expertId", "email", "tokenHash", "tokenStatus", "expiredAt", "createdAt", "updatedAt"
) VALUES (
  '${esc(invitationId)}',
  '${esc(expertId)}',
  '${esc(email)}',
  '${tokenHash}',
  'ACTIVE'::"TokenStatus",
  NOW() + INTERVAL '90 days',
  NOW(),
  NOW()
)
ON CONFLICT ("tokenHash") DO UPDATE SET
  "email" = EXCLUDED."email",
  "tokenStatus" = 'ACTIVE'::"TokenStatus",
  "expiredAt" = EXCLUDED."expiredAt",
  "updatedAt" = NOW();
`);

if (resetApplication) {
  console.log("");
  console.log("COMMIT;");
}
