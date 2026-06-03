type InvitationAccessRecord = {
  tokenStatus: "ACTIVE" | "EXPIRED" | "DISABLED";
  expiredAt: Date | null;
};

export type InvitationAccessBlockReason = "NOT_FOUND" | "DISABLED" | "EXPIRED";

export function getInvitationAccessBlockReason(
  invitation: InvitationAccessRecord | null | undefined,
): InvitationAccessBlockReason | null {
  if (!invitation) {
    return "NOT_FOUND";
  }

  if (invitation.tokenStatus === "DISABLED") {
    return "DISABLED";
  }

  if (invitation.tokenStatus === "EXPIRED") {
    return "EXPIRED";
  }

  if (invitation.expiredAt && invitation.expiredAt.getTime() < Date.now()) {
    return "EXPIRED";
  }

  return null;
}
