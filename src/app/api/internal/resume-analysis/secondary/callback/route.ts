import { NextRequest, NextResponse } from "next/server";

import {
  acceptDirectSecondaryCallback,
  parseDirectSecondaryCallback,
  verifyDirectSecondaryCallback,
} from "@/lib/resume-analysis/direct-secondary";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const eventId = verifyDirectSecondaryCallback({
      headers: request.headers,
      rawBody,
    });
    const payload = parseDirectSecondaryCallback(rawBody);
    if (payload.event_id !== eventId) {
      return NextResponse.json(
        { error: "Event ID mismatch." },
        { status: 400 },
      );
    }

    return NextResponse.json(await acceptDirectSecondaryCallback(payload));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Resume analysis callback processing failed.",
      },
      { status: 500 },
    );
  }
}
