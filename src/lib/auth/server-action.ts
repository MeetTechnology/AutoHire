import { cookies } from "next/headers";

import { validateSessionAccess } from "@/lib/application/service";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth/session";

export async function requireApplicationSessionFromAction(
  applicationId: string,
) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getSessionCookieName())?.value;
  const session = verifySessionToken(sessionCookie);

  if (!session) {
    return null;
  }

  return validateSessionAccess({
    applicationId,
    invitationId: session.invitationId,
  });
}
