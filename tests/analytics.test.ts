import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildIndex,
  periodStats,
  weeklyReport,
} from "@/lib/calculations/analytics";
import {
  annualHeatmap,
  behaviorPatterns,
  currentStreakWithFreezes,
  longestStreakWithFreezes,
} from "@/lib/calculations/decision";
import {
  dateKey,
  currentStreak,
  longestStreak,
  parseDate,
  shiftDate,
  weekStart,
} from "@/lib/calculations/dates";
import { unlock } from "@/lib/calculations/achievements";
import { actions } from "@/lib/persistence/actions";
import { fixture, NOW, session } from "./fixtures";
afterEach(() => vi.restoreAllMocks());
describe("calendar and statistics", () => {
  it("handles month/year/leap boundaries without UTC date shifts", () => {
    expect(shiftDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDate("2025-12-31", 1)).toBe("2026-01-01");
    expect(parseDate("2026-02-29")).toBeNull();
    expect(weekStart("2026-09-20")).toBe("2026-09-14");
  });
  it("allows today to remain unfinished without punishing the current streak", () => {
    expect(
      currentStreak(new Set(["2026-09-13", "2026-09-14"]), "2026-09-15"),
    ).toBe(2);
    expect(currentStreak(new Set(["2026-09-12"]), "2026-09-15")).toBe(0);
    expect(
      longestStreak(["2026-09-12", "2026-09-12", "2026-09-13", "2026-09-15"]),
    ).toBe(2);
  });
  it("splits new midnight sessions into actual local days and hours", () => {
    const start = new Date(2026, 8, 14, 23, 50).getTime(),
      end = start + 20 * 60000,
      d = fixture();
    d.sessions = [
      session({
        date: "2026-09-14",
        startEpoch: start,
        endEpoch: end,
        durationSec: 1200,
        segments: [{ start, end }],
      }),
    ];
    const index = buildIndex(d, "2026-09-15");
    expect(index.days.get("2026-09-14")?.seconds).toBe(600);
    expect(index.days.get("2026-09-15")?.seconds).toBe(600);
    expect(index.hours[23]).toBe(600);
    expect(index.hours[0]).toBe(600);
    expect(index.totalSeconds).toBe(1200);
    expect(periodStats(index, 2, "2026-09-15").sessionCount).toBe(1);
  });
  it("keeps legacy sessions attributed to their saved day", () => {
    const d = fixture();
    d.sessions = [session({ date: "2026-09-14", durationSec: 3600 })];
    expect(buildIndex(d, "2026-09-15").days.get("2026-09-14")?.seconds).toBe(
      3600,
    );
  });
  it("does not double-count manual marks with sessions on the same day", () => {
    const d = actions.markDay("math", "2026-09-15")(fixture()),
      stats = periodStats(buildIndex(d), 7, "2026-09-15");
    expect(stats.studyDays).toBe(1);
    expect(stats.seconds).toBe(60);
    expect(stats.averageDaily).toBeCloseTo(60 / 7);
    expect(stats.consistency).toBeCloseTo(100 / 7);
  });
  it("uses comparable weekdays and avoids fictitious infinite growth", () => {
    const d = fixture();
    d.sessions = [
      session({ date: "2026-09-14", durationSec: 3600 }),
      session({ id: "old-mon", date: "2026-09-07", durationSec: 1800 }),
      session({ id: "old-sun", date: "2026-09-13", durationSec: 7200 }),
    ];
    const w = weeklyReport(buildIndex(d), "2026-09-15");
    expect(w.change).toBe(100);
    expect(w.previousFull).toBe(9000);
    expect(w.previousComparable).toBe(1800);
    expect(weeklyReport(buildIndex(fixture()), "2026-09-15").change).toBeNull();
  });
  it("uses one or two freeze days without creating a streak from an unrelated gap", () => {
    expect(
      currentStreakWithFreezes(
        new Set(["2026-09-13", "2026-09-15"]),
        "2026-09-15",
        1,
      ),
    ).toEqual({ streak: 3, usedFreezes: 1 });
    expect(
      currentStreakWithFreezes(new Set(["2026-09-13"]), "2026-09-15", 1),
    ).toEqual({ streak: 0, usedFreezes: 0 });
    expect(
      longestStreakWithFreezes(["2026-09-10", "2026-09-12", "2026-09-13"], 1),
    ).toBe(4);
  });
  it("builds a year heatmap from actual minutes and keeps non-year cells inert", () => {
    const d = fixture();
    d.sessions = [
      session({
        id: "jan",
        date: "2026-01-01",
        startEpoch: new Date("2026-01-01T10:00:00").getTime(),
        durationSec: 1800,
      }),
      session({
        id: "june",
        date: "2026-06-10",
        startEpoch: new Date("2026-06-10T10:00:00").getTime(),
        durationSec: 3900,
      }),
    ];
    const heatmap = annualHeatmap(buildIndex(d, "2026-09-15"), 2026);
    expect(heatmap.activeDays).toBe(2);
    expect(heatmap.totalMinutes).toBe(95);
    expect(
      heatmap.weeks.flat().find((cell) => cell.date === "2026-01-01"),
    ).toMatchObject({ minutes: 30, level: 2, inYear: true });
    expect(
      heatmap.weeks.flat().find((cell) => cell.date === "2025-12-29"),
    ).toMatchObject({ level: 0, inYear: false });
  });
  it("finds a basic late-night abandonment pattern from explicit discarded timer attempts", () => {
    const d = fixture();
    d.sessions = [
      session({
        id: "late-done-1",
        startEpoch: new Date("2026-09-11T21:10:00").getTime(),
      }),
      session({
        id: "late-done-2",
        startEpoch: new Date("2026-09-12T21:20:00").getTime(),
      }),
      session({
        id: "day",
        startEpoch: new Date("2026-09-12T12:20:00").getTime(),
      }),
    ];
    d.extras.behaviorAttempts = [
      {
        id: "late-drop-1",
        subjectId: "math",
        startEpoch: new Date("2026-09-13T21:10:00").getTime(),
        discardedAt: new Date("2026-09-13T21:20:00").getTime(),
        accumulatedSec: 600,
        targetSec: 1500,
      },
      {
        id: "late-drop-2",
        subjectId: "math",
        startEpoch: new Date("2026-09-14T22:10:00").getTime(),
        discardedAt: new Date("2026-09-14T22:15:00").getTime(),
        accumulatedSec: 300,
        targetSec: 1500,
      },
    ];
    const patterns = behaviorPatterns(d, buildIndex(d, "2026-09-15"));
    expect(patterns[0].body).toContain("50%");
    expect(patterns[0].tone).toBe("attention");
  });
  it("preserves unlocked achievements when history is edited", () => {
    let d = fixture();
    d.sessions[0].durationSec = 36000;
    d = unlock(d, buildIndex(d), "2026-09-15");
    expect(d.achievementsUnlocked.hours_10).toBe("2026-09-15");
    d.sessions = [];
    expect(
      unlock(d, buildIndex(d), "2026-09-16").achievementsUnlocked.hours_10,
    ).toBe("2026-09-15");
  });
  it("session edits preserve exact seconds and original timing for recovery", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 1000);
    const d = fixture(),
      edited = actions.editSession(
        "session-1",
        { note: "New", date: "2026-09-14", durationSec: 125 },
        NOW,
      )(d);
    expect(edited.sessions[0]).toMatchObject({
      durationSec: 125,
      manuallyEdited: true,
      note: "New",
    });
    expect(edited.sessions[0].extras.originalTiming).toHaveProperty(
      "durationSec",
      60,
    );
    expect(() =>
      actions.editSession(
        "session-1",
        { note: "stale", date: "2026-09-15", durationSec: 60 },
        NOW,
      )(edited),
    ).toThrow();
  });
  it("restores deleted subjects and only records deleted with them", () => {
    const d = fixture();
    d.sessions.push(
      session({ id: "already-deleted", deletedAt: 1, updatedAt: 1 }),
    );
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const deleted = actions.deleteSubject("math")(d),
      restored = actions.restore("subjects", "math")(deleted);
    expect(restored.subjects[0].deletedAt).toBeNull();
    expect(restored.sessions[0].deletedAt).toBeNull();
    expect(restored.sessions[1].deletedAt).toBe(1);
  });
  it("indexes 10,000 sessions without quadratic scanning", () => {
    const d = fixture();
    d.sessions = Array.from({ length: 10000 }, (_, i) =>
      session({
        id: String(i),
        date: dateKey(new Date(2025, 0, 1 + (i % 365))),
        durationSec: 60,
        startEpoch: NOW - i * 1000,
      }),
    );
    const started = performance.now(),
      index = buildIndex(d, "2026-09-15"),
      stats = periodStats(index, 365, "2026-09-15"),
      ms = performance.now() - started;
    expect(index.totalSeconds).toBe(600000);
    expect(index.sessions).toHaveLength(10000);
    expect(stats.seconds).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2500);
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      "test-results/performance.json",
      JSON.stringify(
        {
          sessionCount: 10000,
          indexAnd365DayStatsMs: Number(ms.toFixed(2)),
          totalSeconds: index.totalSeconds,
          node: process.version,
          measuredAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.info(
      `10,000 sessions: ${ms.toFixed(1)} ms (index + 365-day statistics)`,
    );
  });
});
