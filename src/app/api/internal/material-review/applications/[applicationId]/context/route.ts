import { NextRequest, NextResponse } from "next/server";

import {
  buildMaterialReviewApplicationContext,
  parseMaterialReviewContextQuery,
} from "@/lib/material-review/context";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ applicationId: string }>;
};

function jsonNoStore(payload: unknown, init?: ResponseInit) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  return scheme?.toLowerCase() === "bearer" ? token : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const env = getEnv();

  if (!env.MATERIAL_REVIEW_API_KEY) {
    return jsonNoStore(
      { error: "MATERIAL_REVIEW_API_KEY is not configured." },
      { status: 503 },
    );
  }

  if (getBearerToken(request.headers) !== env.MATERIAL_REVIEW_API_KEY) {
    return jsonNoStore({ error: "Unauthorized." }, { status: 401 });
  }

  const parsedQuery = parseMaterialReviewContextQuery(
    request.nextUrl.searchParams,
  );

  if (!parsedQuery.ok) {
    return jsonNoStore({ error: parsedQuery.message }, { status: 400 });
  }

  const { applicationId } = await params;
  const context = await buildMaterialReviewApplicationContext({
    applicationId,
    ...parsedQuery.value,
  });

  if (!context) {
    return jsonNoStore({ error: "Application not found." }, { status: 404 });
  }

  return jsonNoStore(context);
}
