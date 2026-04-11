import { S3Client } from "@aws-sdk/client-s3";

import { getEnv } from "@/lib/env";

export function createOssClient() {
  const env = getEnv();

  return new S3Client({
    region: env.ALIYUN_OSS_REGION,
    endpoint: env.ALIYUN_OSS_ENDPOINT,
    credentials: {
      accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.ALIYUN_OSS_ACCESS_KEY_SECRET ?? "",
    },
    forcePathStyle: false,
  });
}
