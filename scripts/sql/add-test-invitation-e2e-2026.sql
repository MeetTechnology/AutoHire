-- 新增一条「从零开始」测试邀约（无对应 Application，首次打开链接会自动建申请）
--
-- 明文 token（仅用于浏览器 URL，勿写入本表）: e2e-flow-token-2026
-- 访问: http://localhost:<端口>/apply?t=e2e-flow-token-2026
--
-- tokenHash = SHA256(明文) 的 hex，与 src/lib/auth/token.ts 中 hashInviteToken 一致

INSERT INTO "ExpertInvitation" (
  "id",
  "expertId",
  "email",
  "tokenHash",
  "tokenStatus",
  "expiredAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  'invitation_e2e_2026',
  'expert_e2e_2026',
  'e2e-test@example.com',
  '7b4e832fe787090710f3a8aaa1c5705f6821b09f4ca7e5a532aba9d117069f81',
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
