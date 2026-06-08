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
 *   node scripts/print-test-invitation-sql.mjs [明文token] [invitationId] [expertId] [email] [--reset-application]
 *
 * 明文 token 省略时，自动生成为 YYYYMMDD + 三位序号（如 20260608001），序号按日顺延，状态保存在
 * scripts/.test-invitation-token-seq.json。
 *
 * 示例:
 *   node scripts/print-test-invitation-sql.mjs
 *   node scripts/print-test-invitation-sql.mjs 20260608001
 *   node scripts/print-test-invitation-sql.mjs 20260608001 invitation_abc expert_abc a@b.com
 *   node scripts/print-test-invitation-sql.mjs --reset-application
 *
 * 执行 SQL（可复制）:
 *   node scripts/print-test-invitation-sql.mjs 20260608001 | bunx --bun prisma db execute --stdin
 *   node scripts/print-test-invitation-sql.mjs 20260608001 --reset-application | bunx --bun prisma db execute --stdin
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const seqStatePath = join(scriptDir, ".test-invitation-token-seq.json");

const rawArgs = process.argv.slice(2);
const resetApplication = rawArgs.includes("--reset-application");
const showHelp = rawArgs.includes("--help") || rawArgs.includes("-h");
const positional = rawArgs.filter(
  (a) => a !== "--reset-application" && a !== "--help" && a !== "-h",
);

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function readSeqState() {
  try {
    const raw = readFileSync(seqStatePath, "utf8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.dateKey === "string" &&
      typeof parsed?.nextSeq === "number" &&
      parsed.nextSeq >= 1
    ) {
      return parsed;
    }
  } catch {
    // 首次运行或文件损坏时从 001 开始
  }
  return { dateKey: getDateKey(), nextSeq: 1 };
}

function writeSeqState(state) {
  mkdirSync(dirname(seqStatePath), { recursive: true });
  writeFileSync(seqStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function generateAutoToken() {
  const today = getDateKey();
  const state = readSeqState();
  const nextSeq = state.dateKey === today ? state.nextSeq : 1;
  const token = `${today}${String(nextSeq).padStart(3, "0")}`;
  writeSeqState({ dateKey: today, nextSeq: nextSeq + 1 });
  return token;
}

function buildExecuteCommand(token) {
  const args = ["node", "scripts/print-test-invitation-sql.mjs", token];
  if (resetApplication) {
    args.push("--reset-application");
  }
  return `${args.join(" ")} | bunx --bun prisma db execute --stdin`;
}

if (showHelp) {
  console.error(
    [
      "用法: node scripts/print-test-invitation-sql.mjs [明文token] [invitationId] [expertId] [email] [--reset-application]",
      "",
      "明文 token 省略时自动生成为 YYYYMMDD + 三位序号（如 20260608001），按日顺延。",
      "",
      "--reset-application  在写入邀请前删除该 token（tokenHash）已关联的 Application 及子表，便于同一链接获得新的 applicationId。",
      "仅建议在本地/开发库使用；会清除该申请下的简历、分析任务、材料等数据。",
      "",
      "执行 SQL:",
      "  node scripts/print-test-invitation-sql.mjs | bunx --bun prisma db execute --stdin",
      "  node scripts/print-test-invitation-sql.mjs 20260608001 | bunx --bun prisma db execute --stdin",
    ].join("\n"),
  );
  process.exit(0);
}

const tokenProvided = positional.length > 0;
const token = tokenProvided ? positional[0] : generateAutoToken();
const invitationId =
  positional[tokenProvided ? 1 : 0] ??
  `invitation_${randomBytes(8).toString("hex")}`;
const expertId =
  positional[tokenProvided ? 2 : 1] ??
  `expert_${randomBytes(8).toString("hex")}`;
const email =
  positional[tokenProvided ? 3 : 2] ?? "test@example.com";
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

console.error(
  [
    tokenProvided ? `-- 明文 token: ${token}` : `-- 自动 token: ${token}`,
    `-- 链接: /apply?t=${encodeURIComponent(token)}`,
    "-- 执行（复制）:",
    buildExecuteCommand(token),
    "",
  ].join("\n"),
);

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
