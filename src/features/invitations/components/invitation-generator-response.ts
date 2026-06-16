import type { InvitationGenerationBatchSummary } from "@/lib/invitations/generation";

type GenerateResponse = {
  readonly batch: InvitationGenerationBatchSummary;
};

function isGenerateResponse(value: unknown): value is GenerateResponse {
  if (typeof value !== "object" || value === null || !("batch" in value)) {
    return false;
  }

  const batch = value.batch;

  return typeof batch === "object" && batch !== null;
}

async function readResponseJson(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  const body = await response.text();

  if (!body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload)
  ) {
    return fallback;
  }

  return typeof payload.error === "string" ? payload.error : fallback;
}

function getGenerationFailureMessage(payload: unknown, status: number) {
  const fallback = status
    ? `Invitation generation failed (HTTP ${status}).`
    : "Invitation generation failed.";

  return readErrorMessage(payload, fallback);
}

export async function readGenerateResponse(response: Response) {
  const payload = await readResponseJson(response);

  if (!response.ok || !isGenerateResponse(payload)) {
    throw new Error(getGenerationFailureMessage(payload, response.status));
  }

  return payload;
}
