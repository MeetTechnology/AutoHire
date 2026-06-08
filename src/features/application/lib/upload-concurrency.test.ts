import { describe, expect, it } from "vitest";

import { runWithConcurrency } from "@/features/application/lib/upload-concurrency";

describe("runWithConcurrency", () => {
  it("returns an empty array for no items", async () => {
    await expect(runWithConcurrency([], 3, async () => {})).resolves.toEqual([]);
  });

  it("runs all workers and preserves result order", async () => {
    const order: number[] = [];

    const results = await runWithConcurrency([1, 2, 3], 2, async (item) => {
      order.push(item);
    });

    expect(order).toEqual([1, 2, 3]);
    expect(results).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ]);
  });

  it("limits concurrent workers", async () => {
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("isolates rejected workers without stopping the rest", async () => {
    const results = await runWithConcurrency(["ok", "fail", "ok"], 3, async (item) => {
      if (item === "fail") {
        throw new Error("upload failed");
      }
    });

    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]?.status).toBe("rejected");
    expect(results[2]?.status).toBe("fulfilled");
  });
});
