import { describe, it, expect } from "vitest";
import { insights, suggestPlan } from "@/lib/assistant/provider";
import { buildIndex } from "@/lib/calculations/analytics";
import { fixture, subject } from "./fixtures";
describe("data-grounded suggestions", () => {
  it("does not invent productive hours when original timestamps are unknown", () => {
    const d = fixture();
    d.sessions = Array.from({ length: 4 }, (_, i) => ({
      ...d.sessions[0],
      id: String(i),
      startTimeEstimated: true,
    }));
    const index = buildIndex(d);
    expect(index.totalSeconds).toBe(240);
    expect(index.hours.reduce((a, b) => a + b, 0)).toBe(0);
    expect(insights(index, "2026-09-15").some((i) => i.id === "hour")).toBe(
      false,
    );
  });
  it("distributes exactly the selected time budget over actual active subjects", () => {
    const d = fixture();
    d.subjects.push(subject("japanese", "Япон хэл"), subject("code", "Код"));
    const plan = suggestPlan(d, buildIndex(d), "2026-09-15", 61);
    expect(plan.reduce((n, p) => n + p.minutes, 0)).toBe(61);
    expect(plan[0].subjectId).not.toBe("math");
    expect(
      plan.every((p) => d.subjects.some((s) => s.id === p.subjectId)),
    ).toBe(true);
  });
});
