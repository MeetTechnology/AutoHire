import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { MaterialCategory } from "@/features/application/types";
import { getEnv } from "@/lib/env";
import { createOssClient } from "@/lib/oss/client";

export function createObjectKey(input: {
  applicationId: string;
  fileName: string;
  category?: MaterialCategory;
  kind: "resume" | "materials";
}) {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();

  if (input.kind === "resume") {
    return `applications/${input.applicationId}/resume/${timestamp}-${safeName}`;
  }

  return `applications/${input.applicationId}/materials/${input.category}/${timestamp}-${safeName}`;
}

export async function createUploadIntent(input: {
  fileType: string;
  objectKey: string;
  requestOrigin: string;
}) {
  const env = getEnv();

  if (env.FILE_STORAGE_MODE === "oss") {
    const client = createOssClient();
    const command = new PutObjectCommand({
      Bucket: env.ALIYUN_OSS_BUCKET,
      Key: input.objectKey,
      ContentType: input.fileType,
    });

    return {
      uploadUrl: await getSignedUrl(client, command, { expiresIn: 300 }),
      method: "PUT",
      headers: {
        "Content-Type": input.fileType,
      },
      objectKey: input.objectKey,
    };
  }

  return {
    uploadUrl: `/api/mock-storage?key=${encodeURIComponent(input.objectKey)}`,
    method: "PUT",
    headers: {
      "Content-Type": input.fileType,
    },
    objectKey: input.objectKey,
  };
}
