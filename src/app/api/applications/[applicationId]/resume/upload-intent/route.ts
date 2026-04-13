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

  const body = await parseJsonBody(request);
  const parsed = uploadIntentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("The upload request payload is invalid.", 400, {
      details: parsed.error.flatten(),
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
    kind: "resume",
  });

  return NextResponse.json(
    await createUploadIntent({
      fileType: parsed.data.fileType,
      objectKey,
      requestOrigin: request.nextUrl.origin,
    }),
  );
}
