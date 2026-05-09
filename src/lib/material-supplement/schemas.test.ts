import { describe, expect, it } from "vitest";

import {
  getSupplementCallbackHeaders,
  supplementConfirmFileRequestSchema,
  supplementConfirmUploadBatchRequestSchema,
  supplementCallbackHeadersSchema,
  supplementInitialReviewRequestSchema,
  supplementUploadBatchRequestSchema,
  supplementUploadIntentRequestSchema,
  supplementReviewCallbackBodySchema,
} from "@/lib/material-supplement/schemas";

describe("supplementInitialReviewRequestSchema", () => {
  it("accepts only an empty object", () => {
    expect(supplementInitialReviewRequestSchema.safeParse({}).success).toBe(true);
    expect(
      supplementInitialReviewRequestSchema.safeParse({ created: true }).success,
    ).toBe(false);
  });
});

describe("supplement upload request schemas", () => {
  it("accepts only category for upload batch creation", () => {
    expect(
      supplementUploadBatchRequestSchema.safeParse({
        category: "EDUCATION",
      }).success,
    ).toBe(true);
    expect(
      supplementUploadBatchRequestSchema.safeParse({
        category: "EDUCATION",
        fileName: "degree.pdf",
      }).success,
    ).toBe(false);
  });

  it("accepts upload intent payloads and keeps supplement request optional", () => {
    expect(
      supplementUploadIntentRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
      }).success,
    ).toBe(true);
    expect(
      supplementUploadIntentRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        supplementRequestId: "req_001",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
      }).success,
    ).toBe(true);
  });

  it("keeps upload intent category validation in the service layer", () => {
    expect(
      supplementUploadIntentRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "PRODUCT",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid upload intent file sizes", () => {
    expect(
      supplementUploadIntentRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts file confirmation payloads with an optional supplement request", () => {
    expect(
      supplementConfirmFileRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        objectKey: "applications/app_001/supplements/EDUCATION/batch_001/degree.pdf",
      }).success,
    ).toBe(true);
    expect(
      supplementConfirmFileRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        supplementRequestId: "req_001",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        objectKey: "applications/app_001/supplements/EDUCATION/batch_001/degree.pdf",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid file confirmation payloads", () => {
    expect(
      supplementConfirmFileRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 0,
        objectKey: "applications/app_001/supplements/EDUCATION/batch_001/degree.pdf",
      }).success,
    ).toBe(false);
    expect(
      supplementConfirmFileRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        objectKey: "",
      }).success,
    ).toBe(false);
    expect(
      supplementConfirmFileRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "EDUCATION",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        objectKey: "applications/app_001/supplements/EDUCATION/batch_001/degree.pdf",
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("keeps file confirmation category validation in the service layer", () => {
    expect(
      supplementConfirmFileRequestSchema.safeParse({
        uploadBatchId: "batch_001",
        category: "PRODUCT",
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 123456,
        objectKey: "applications/app_001/supplements/PRODUCT/batch_001/degree.pdf",
      }).success,
    ).toBe(true);
  });

  it("accepts only category for upload batch confirmation", () => {
    expect(
      supplementConfirmUploadBatchRequestSchema.safeParse({
        category: "EDUCATION",
      }).success,
    ).toBe(true);
    expect(
      supplementConfirmUploadBatchRequestSchema.safeParse({
        category: "EDUCATION",
        uploadBatchId: "batch_001",
      }).success,
    ).toBe(false);
  });
});

describe("supplementCallbackHeadersSchema", () => {
  it("rejects missing or blank callback headers", () => {
    expect(
      supplementCallbackHeadersSchema.safeParse({
        "x-material-review-signature": "",
        "x-material-review-timestamp": " ",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed callback timestamps", () => {
    expect(
      supplementCallbackHeadersSchema.safeParse({
        "x-material-review-signature": "signature-value",
        "x-material-review-timestamp": "abc",
      }).success,
    ).toBe(false);
  });

  it("extracts normalized callback headers from Headers", () => {
    const headers = new Headers({
      "X-Material-Review-Signature": "signature-value",
      "X-Material-Review-Timestamp": "2026-05-05T10:08:05.000Z",
    });

    expect(getSupplementCallbackHeaders(headers)).toEqual({
      "x-material-review-signature": "signature-value",
      "x-material-review-timestamp": "2026-05-05T10:08:05.000Z",
    });
  });
});

describe("supplementReviewCallbackBodySchema", () => {
  const validPayload = {
    externalRunId: "external_run_001",
    status: "COMPLETED",
    finishedAt: "2026-05-05T10:08:00.000Z",
    categories: [
      {
        category: "EDUCATION",
        status: "COMPLETED",
        reviewedAt: "2026-05-05T10:08:00.000Z",
        aiMessage:
          "Please upload a doctoral degree certificate or an equivalent education verification document.",
        resultPayload: {
          supplementRequired: true,
          requests: [
            {
              title: "Doctoral degree proof required",
              reason:
                "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
              suggestedMaterials: [
                "Doctoral degree certificate",
                "Education verification report",
              ],
              aiMessage:
                "Please upload a doctoral degree certificate or an equivalent education verification document.",
              status: "PENDING",
            },
          ],
        },
        rawResultPayload: null,
      },
    ],
  } as const;

  it("accepts the minimum valid callback payload", () => {
    expect(supplementReviewCallbackBodySchema.safeParse(validPayload).success).toBe(
      true,
    );
  });

  it("rejects an empty externalRunId", () => {
    expect(
      supplementReviewCallbackBodySchema.safeParse({
        ...validPayload,
        externalRunId: " ",
      }).success,
    ).toBe(false);
  });

  it("rejects an unsupported status", () => {
    expect(
      supplementReviewCallbackBodySchema.safeParse({
        ...validPayload,
        status: "DONE",
      }).success,
    ).toBe(false);
  });

  it("rejects an unsupported category", () => {
    expect(
      supplementReviewCallbackBodySchema.safeParse({
        ...validPayload,
        categories: [
          {
            ...validPayload.categories[0],
            category: "PRODUCT",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects callback payloads missing resultPayload", () => {
    expect(
      supplementReviewCallbackBodySchema.safeParse({
        ...validPayload,
        categories: [
          {
            category: "EDUCATION",
            status: "COMPLETED",
            aiMessage: "Please provide proof of the doctoral degree listed in your CV.",
            rawResultPayload: null,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
