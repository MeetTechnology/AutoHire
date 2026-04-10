import { S3Client } from "@aws-sdk/client-s3";

export function createOssClient() {
  return new S3Client({
    region: process.env.ALIYUN_OSS_REGION,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT,
    credentials: {
      accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET ?? "",
    },
    forcePathStyle: false,
  });
}
