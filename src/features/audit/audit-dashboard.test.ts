import { describe, expect, it } from "vitest";

import { displayLabel, displaySlices } from "@/features/audit/audit-dashboard";

describe("audit dashboard display labels", () => {
  it("normalizes and translates historical tracking label variants", () => {
    expect(displayLabel("INTRO VIEWED")).toBe("查看引导页");
    expect(displayLabel("INFO REQUIRED")).toBe("信息待补充");
    expect(displayLabel("submission completeduration recorded")).toBe(
      "提交完成页停留已记录",
    );
    expect(displayLabel("HISTORY ONLY")).toBe("仅历史记录");
    expect(displayLabel("SATISFIED")).toBe("已满足");
  });

  it("aggregates values after labels are translated", () => {
    expect(
      displaySlices([
        { name: "SATISFIED", value: 2 },
        { name: "satisfied", value: 3 },
        { name: "HISTORY_ONLY", value: 4 },
        { name: "HISTORY ONLY", value: 5 },
      ]),
    ).toEqual([
      { name: "仅历史记录", value: 9 },
      { name: "已满足", value: 5 },
    ]);
  });
});
