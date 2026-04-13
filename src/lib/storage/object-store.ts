import { GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getEnv } from "@/lib/env";
import { createOssClient } from "@/lib/oss/client";

const MOCK_STORAGE_ROOT = path.join(process.cwd(), ".data", "mock-storage");

function getMockStoragePath(objectKey: string) {
  const segments = objectKey
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/\.\./g, "_")
        .replace(/[<>:"|?*\u0000-\u001f]/g, "_"),
    );

  if (segments.length === 0) {
    throw new Error("Object key is required.");
  }

  return path.join(MOCK_STORAGE_ROOT, ...segments);
}

async function readAsyncIterable(
  iterable: AsyncIterable<Uint8Array | string>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of iterable) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk),
    );
  }

  return Buffer.concat(chunks);
}

function toBuffer(payload: ArrayBuffer | Buffer | Uint8Array) {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (payload instanceof Uint8Array) {
    return Buffer.from(payload);
  }

  return Buffer.from(payload);
}

async function readOssObject(objectKey: string) {
  const env = getEnv();
  const client = createOssClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.ALIYUN_OSS_BUCKET,
      Key: objectKey,
    }),
  );

  const body = response.Body;

  if (!body) {
    throw new Error("Stored object body is empty.");
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  if (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in body
  ) {
    return readAsyncIterable(
      body as AsyncIterable<Uint8Array | string>,
    );
  }

  throw new Error("Unsupported object storage response body.");
}

export async function writeMockObject(
  objectKey: string,
  payload: ArrayBuffer | Buffer | Uint8Array,
) {
  const filePath = getMockStoragePath(objectKey);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, toBuffer(payload));
}

export async function readMockObject(objectKey: string) {
  return readFile(getMockStoragePath(objectKey));
}

export async function readStoredObject(objectKey: string) {
  const env = getEnv();

  if (env.FILE_STORAGE_MODE === "oss") {
    return readOssObject(objectKey);
  }

  return readMockObject(objectKey);
}
