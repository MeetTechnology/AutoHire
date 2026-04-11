import { NextRequest } from "next/server";

import { verifySessionToken, getSessionCookieName } from "@/lib/auth/session";
import { validateSessionAccess } from "@/lib/application/service";

export async function requireApplicationSession(
  request: NextRequest,
  applicationId: string,
) {
  const sessionCookie = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(sessionCookie);

  if (!session) {
    return null;
  }

  const application = await validateSessionAccess({
    applicationId,
    invitationId: session.invitationId,
  });

  if (!application) {
    return null;
  }

  return {
    application,
    session,
  };
}
