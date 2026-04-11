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
      return jsonError("无效的邀约链接。", 401, { code: "INVALID_TOKEN" });
    }

    if (invitation.tokenStatus === "DISABLED") {
      return jsonError("当前邀约链接已禁用。", 403, { code: "DISABLED_TOKEN" });
    }

    if (invitation.expiredAt && invitation.expiredAt.getTime() < Date.now()) {
      return jsonError("当前邀约链接已过期。", 410, { code: "EXPIRED_TOKEN" });
    }

    const application = await createOrRestoreApplication({
      id: invitation.id,
      expertId: invitation.expertId,
    });
    const snapshot = await getSnapshot(application.id);
    const sessionToken = await createSessionForApplication(application.id);

    if (!snapshot || !sessionToken) {
      return jsonError("无法初始化申请会话。", 500);
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
    return jsonError("未找到有效会话，请重新通过邀约链接进入。", 401, {
      code: "SESSION_REQUIRED",
    });
  }

  const snapshot = await getSnapshot(session.applicationId);

  if (!snapshot) {
    return jsonError("当前申请记录不存在。", 404, {
      code: "APPLICATION_NOT_FOUND",
    });
  }

  return NextResponse.json(snapshot);
}
