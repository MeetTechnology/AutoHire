import { hashInviteToken } from "@/lib/auth/token";

export const SAMPLE_TOKENS = {
  init: "sample-init-token",
  progress: "sample-progress-token",
  submitted: "sample-submitted-token",
  secondary: "sample-secondary-token",
} as const;

export function getSampleInvitationSeeds() {
  const now = new Date();
  const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  return [
    {
      id: "invitation_init",
      expertId: "expert_init",
      email: "init@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.init),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_progress",
      expertId: "expert_progress",
      email: "progress@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.progress),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_submitted",
      expertId: "expert_submitted",
      email: "submitted@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.submitted),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_secondary",
      expertId: "expert_secondary",
      email: "secondary@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.secondary),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
