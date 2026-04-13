import { NextRequest, NextResponse } from "next/server";

import {
  createOrRestoreApplication,
  createSessionForApplication,
  getSnapshot,
  resolveInviteToken,
} from "@/lib/application/service";
import {
  getSessionCookieName,
  getSessionMaxAgeSeconds,
  verifySessionToken,
} from "@/lib/auth/session";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (token) {
    const invitation = await resolveInviteToken(token);

    if (!invitation) {
      return jsonError("The invitation link is invalid.", 401, {
        code: "INVALID_TOKEN",
      });
    }

    if (invitation.tokenStatus === "DISABLED") {
      return jsonError("This invitation link has been disabled.", 403, {
        code: "DISABLED_TOKEN",
      });
    }

    if (invitation.expiredAt && invitation.expiredAt.getTime() < Date.now()) {
      return jsonError("This invitation link has expired.", 410, {
        code: "EXPIRED_TOKEN",
      });
    }

    const application = await createOrRestoreApplication({
      id: invitation.id,
      expertId: invitation.expertId,
    });
    const snapshot = await getSnapshot(application.id);
    const sessionToken = await createSessionForApplication(application.id);

    if (!snapshot || !sessionToken) {
      return jsonError("Unable to initialize the application session.", 500);
    }

    const response = NextResponse.json(snapshot);
    response.cookies.set({
      name: getSessionCookieName(),
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getSessionMaxAgeSeconds(),
    });

    return response;
  }

  const cookieValue = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(cookieValue);

  if (!session) {
    return jsonError("No valid session was found. Please reopen the invitation link.", 401, {
      code: "SESSION_REQUIRED",
    });
  }

  const snapshot = await getSnapshot(session.applicationId);

  if (!snapshot) {
    return jsonError("The application record could not be found.", 404, {
      code: "APPLICATION_NOT_FOUND",
    });
  }

  return NextResponse.json(snapshot);
}
