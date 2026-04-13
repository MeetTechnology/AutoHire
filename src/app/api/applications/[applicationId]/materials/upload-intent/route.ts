import { NextRequest, NextResponse } from "next/server";

import { uploadIntentSchema } from "@/features/application/schemas";
import { requireApplicationSession } from "@/lib/auth/access";
import { jsonError, parseJsonBody } from "@/lib/http";
import { createObjectKey, createUploadIntent } from "@/lib/upload/service";
import { validateUpload } from "@/lib/validation/upload";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { applicationId } = await params;
  const access = await requireApplicationSession(request, applicationId);

  if (!access) {
    return jsonError(
      "The current session is not authorized to access this application.",
      403,
    );
  }

  if (access.application.applicationStatus !== "MATERIALS_IN_PROGRESS") {
    return jsonError(
      "Supporting materials can only be uploaded after the detailed analysis is complete.",
      409,
      {
        code: "MATERIALS_STAGE_NOT_READY",
      },
    );
  }

  const body = await parseJsonBody(request);
  const parsed = uploadIntentSchema.safeParse(body);

  if (!parsed.success || !parsed.data.category) {
    return jsonError("The material upload request payload is invalid.", 400, {
      details: parsed.success
        ? { category: ["Material category is required."] }
        : parsed.error.flatten(),
    });
  }

  const validation = validateUpload(parsed.data.fileName, parsed.data.fileSize);

  if (!validation.valid) {
    return jsonError("The file does not meet the upload requirements.", 400, {
      code: validation.reason,
    });
  }

  const objectKey = createObjectKey({
    applicationId,
    fileName: parsed.data.fileName,
    category: parsed.data.category,
    kind: "materials",
  });

  return NextResponse.json(
    await createUploadIntent({
      fileType: parsed.data.fileType,
      objectKey,
      requestOrigin: request.nextUrl.origin,
    }),
  );
}
