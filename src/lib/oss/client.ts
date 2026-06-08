import { S3Client } from "@aws-sdk/client-s3";

import { getEnv } from "@/lib/env";

function getOssEndpoint() {
  const env = getEnv();

  return env.ALIYUN_OSS_TRANSFER_ACCELERATION_ENABLED
    ? env.ALIYUN_OSS_ACCELERATE_ENDPOINT
    : env.ALIYUN_OSS_ENDPOINT;
}

export function createOssClient() {
  const env = getEnv();

  return new S3Client({
    region: env.ALIYUN_OSS_REGION,
    endpoint: getOssEndpoint(),
    credentials: {
      accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.ALIYUN_OSS_ACCESS_KEY_SECRET ?? "",
    },
    forcePathStyle: false,
  });
}
