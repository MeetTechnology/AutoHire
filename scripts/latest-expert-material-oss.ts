/**
 * 使用仓库根目录的 .env（Bun 启动时会自动加载），在 OSS Bucket 中查找
 * 「专家侧资料」路径下 LastModified 最新的一条对象。
 *
 * 路径约定与业务代码一致：
 * - 初申材料: applications/{id}/materials/...
 * - 补件: applications/{id}/supplements/...
 *
 * 用法（在仓库根目录）:
 *   bun scripts/latest-expert-material-oss.ts
 *
 * 可选环境变量:
 *   OSS_LIST_PREFIX — 列举前缀，默认 applications/
 */
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import { getEnv } from "../src/lib/env";
import { createOssClient } from "../src/lib/oss/client";

function isExpertMaterialKey(key: string) {
  return key.includes("/materials/") || key.includes("/supplements/");
}

async function main() {
  const env = getEnv();

  if (env.FILE_STORAGE_MODE !== "oss") {
    console.error(
      "FILE_STORAGE_MODE 不是 oss，请在 .env 中设为 oss 后再运行本脚本。",
    );
    process.exit(1);
  }

  if (
    !env.ALIYUN_OSS_BUCKET ||
    !env.ALIYUN_OSS_ENDPOINT ||
    !env.ALIYUN_OSS_ACCESS_KEY_ID ||
    !env.ALIYUN_OSS_ACCESS_KEY_SECRET
  ) {
    console.error("缺少 ALIYUN_OSS_BUCKET / ENDPOINT / ACCESS_KEY 等配置。");
    process.exit(1);
  }

  const prefix = process.env.OSS_LIST_PREFIX?.trim() || "applications/";
  const client = createOssClient();

  let continuationToken: string | undefined;
  let best: {
    Key: string;
    LastModified: Date;
    Size: number;
  } | null = null;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: env.ALIYUN_OSS_BUCKET,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of res.Contents ?? []) {
      if (!obj.Key || !obj.LastModified) continue;
      if (!isExpertMaterialKey(obj.Key)) continue;

      const size = obj.Size ?? 0;
      if (!best || obj.LastModified > best.LastModified) {
        best = {
          Key: obj.Key,
          LastModified: obj.LastModified,
          Size: size,
        };
      }
    }

    continuationToken = res.IsTruncated
      ? res.NextContinuationToken
      : undefined;
  } while (continuationToken);

  if (!best) {
    console.log(
      JSON.stringify(
        {
          message: "未找到匹配 materials/ 或 supplements/ 的对象",
          prefix,
        },
        null,
        2,
      ),
    );
    process.exit(0);
    return;
  }

  console.log(
    JSON.stringify(
      {
        bucket: env.ALIYUN_OSS_BUCKET,
        objectKey: best.Key,
        lastModified: best.LastModified.toISOString(),
        sizeBytes: best.Size,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
