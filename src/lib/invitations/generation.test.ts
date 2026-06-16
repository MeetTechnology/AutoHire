import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveInviteToken } from "@/lib/application/service";
import { resetEnvForTests } from "@/lib/env";
import {
  generateInvitationBatch,
  invitationGenerationRequestSchema,
} from "@/lib/invitations/generation";

const originalEnv = { ...process.env };

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("invitation generation service", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_RUNTIME_MODE: "memory",
      APP_BASE_URL: "https://example.test",
    };
    resetEnvForTests();
    resetMemoryStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTests();
    resetMemoryStore();
  });

  it("creates invitations that can be resolved by the selected hash algorithm", async () => {
    const input = invitationGenerationRequestSchema.parse({
      algorithm: "SHA512",
      count: 2,
      expiredDays: 90,
      idempotencyKey: "invite-test-sha512",
    });

    const batch = await generateInvitationBatch(input);

    expect(batch.items).toHaveLength(2);
    expect(batch.items[0]?.plaintextToken).toMatch(/^[0-9a-f]{64}$/);
    expect(batch.items[0]?.inviteLink).toContain(
      "https://example.test/apply?t=",
    );
    expect(batch.items[0]?.hashAlgorithm).toBe("SHA512");

    const invitation = await resolveInviteToken(
      batch.items[0]?.plaintextToken ?? "",
    );
    expect(invitation?.id).toBe(batch.items[0]?.invitationId);
  });

  it("reuses an existing batch for the same idempotency key", async () => {
    const input = invitationGenerationRequestSchema.parse({
      algorithm: "SHA256",
      count: 3,
      idempotencyKey: "invite-test-idempotent",
    });

    const first = await generateInvitationBatch(input);
    const second = await generateInvitationBatch(input);

    expect(second.id).toBe(first.id);
    expect(second.items.map((item) => item.plaintextToken)).toEqual(
      first.items.map((item) => item.plaintextToken),
    );
  });

  it("creates a new batch for a different idempotency key", async () => {
    const first = await generateInvitationBatch(
      invitationGenerationRequestSchema.parse({
        algorithm: "SHA256",
        count: 1,
        idempotencyKey: "invite-test-key-a",
      }),
    );
    const second = await generateInvitationBatch(
      invitationGenerationRequestSchema.parse({
        algorithm: "SHA256",
        count: 1,
        idempotencyKey: "invite-test-key-b",
      }),
    );

    expect(second.id).not.toBe(first.id);
    expect(second.items[0]?.plaintextToken).not.toBe(
      first.items[0]?.plaintextToken,
    );
  });
});
