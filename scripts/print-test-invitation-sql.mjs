#!/usr/bin/env node
/**
 * 打印一条 ExpertInvitation 的 INSERT SQL（tokenHash 与 hashInviteToken 一致）。
 *
 * 用法:
 *   node scripts/print-test-invitation-sql.mjs <明文token> [invitationId] [expertId] [email]
 *
 * 示例:
 *   node scripts/print-test-invitation-sql.mjs my-invite-002
 *   node scripts/print-test-invitation-sql.mjs my-invite-002 invitation_abc expert_abc a@b.com
 *
 * 执行 SQL（把密码换成你的）:
 *   node scripts/print-test-invitation-sql.mjs my-invite-002 | E:\PostgreSQL\17\bin\psql.exe -h localhost -p 5432 -U postgres -d autohire
 */

import { createHash, randomBytes } from "node:crypto";

const token = process.argv[2];

if (!token) {
  console.error(
    "用法: node scripts/print-test-invitation-sql.mjs <明文token> [invitationId] [expertId] [email]",
  );
  process.exit(1);
}

const invitationId =
  process.argv[3] ?? `invitation_${randomBytes(8).toString("hex")}`;
const expertId = process.argv[4] ?? `expert_${randomBytes(8).toString("hex")}`;
const email = process.argv[5] ?? "test@example.com";
const tokenHash = createHash("sha256").update(token).digest("hex");

const esc = (s) => s.replace(/'/g, "''");

console.log(`-- 明文 token: ${token}`);
console.log(`-- 链接: /apply?t=${encodeURIComponent(token)}`);
console.log("");
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
