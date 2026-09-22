import { describe, it, expect } from "vitest";
import { migrate } from "@/lib/migration/migrate";
import { mergeData, resolveConflict } from "@/lib/migration/merge";
import { buildIndex } from "@/lib/calculations/analytics";
import { actions } from "@/lib/persistence/actions";
import { fixture, NOW, session, subject } from "./fixtures";
describe("v2 compatibility and safe merges", () => {
  it("preserves numeric IDs, exact seconds, notes, goals, achievements and extensions", () => {
    const input = {
      schemaVersion: 2,
      subjects: [
        { id: 7, name: "日本語", color: "#9eb6a0", custom: { abc: 1 } },
      ],
      entries: [{ subjectId: 7, date: "2026-09-14" }],
      sessions: [
        {
          id: 123,
          subjectId: 7,
          date: "2026-09-14",
          durationSec: 125.5,
          note: " 漢字 ",
          startEpoch: NOW,
        },
      ],
      goals: { weeklyHours: 8, weeklyDays: 3, customGoal: "ok" },
      settings: { theme: "dark", customTheme: "moss" },
      achievementsUnlocked: {
        first_study: "2026-01-01",
        future_badge: "2026-02-01",
      },
      future: "keep",
    };
    const d = migrate(input);
    expect(d.subjects[0].id).toBe("7");
    expect(d.subjects[0].extras.custom).toEqual({ abc: 1 });
    expect(d.sessions[0]).toMatchObject({
      id: "123",
      subjectId: "7",
      durationSec: 125.5,
      note: " 漢字 ",
    });
    expect(d.goals.weeklyHours).toBe(8);
    expect(d.goals.extras.customGoal).toBe("ok");
    expect(d.settings.extras.customTheme).toBe("moss");
    expect(d.achievementsUnlocked).toEqual(input.achievementsUnlocked);
    expect(d.extras.future).toBe("keep");
    expect(input.schemaVersion).toBe(2);
  });
  it("migrates both v2 and legacy active timers", () => {
    const base = fixture();
    const a = migrate({
      ...base,
      activeTimer: {
        id: 7,
        subjectId: "math",
        running: true,
        startEpoch: NOW,
        accumulatedMs: 10000,
      },
    });
    expect(a.activeTimer).toMatchObject({
      id: "7",
      sessionStartedAt: NOW - 10000,
      runningSince: NOW,
      startTimeEstimated: true,
    });
    const b = migrate({
      ...base,
      activeTimer: {
        id: "v2",
        subjectId: "math",
        date: "2026-09-15",
        sessionStartedAt: NOW,
        runningSince: NOW + 20000,
        running: true,
        accumulatedMs: 10000,
        note: "keep",
      },
    });
    expect(b.activeTimer).toMatchObject({
      id: "v2",
      sessionStartedAt: NOW,
      runningSince: NOW + 20000,
      note: "keep",
      startTimeEstimated: false,
    });
  });
  it("is idempotent for migrated data and gives deterministic IDs to old sessions", () => {
    const raw = {
      subjects: [{ id: "m", name: "Math" }],
      sessions: [{ subjectId: "m", date: "2026-01-01", durationSec: 60 }],
      entries: [],
    };
    expect(migrate(raw)).toEqual(migrate(migrate(raw)));
    expect(migrate(raw).sessions[0].id).toBe(migrate(raw).sessions[0].id);
  });
  it("quarantines malformed records and retains orphan subject links", () => {
    const raw = {
      subjects: [],
      sessions: [
        { subjectId: "lost", date: "2026-09-14", durationSec: 30 },
        { durationSec: -1 },
        null,
      ],
      entries: [],
    };
    const d = migrate(raw);
    expect(d.sessions).toHaveLength(1);
    expect(d.quarantine).toHaveLength(2);
    expect(d.subjects[0]).toMatchObject({ id: "lost", archived: true });
    expect(d.quarantine[0].value).toEqual(raw.sessions[1]);
  });
  it("rejects unknown and future schemas", () => {
    expect(() => migrate({ random: "value" })).toThrow();
    expect(() => migrate({ ...fixture(), schemaVersion: 6 })).toThrow();
  });
  it("preserves duplicate source records by recovering unique IDs", () => {
    const d = fixture();
    d.sessions.push({ ...d.sessions[0], note: "different" });
    const next = migrate(d);
    expect(next.sessions).toHaveLength(2);
    expect(new Set(next.sessions.map((s) => s.id)).size).toBe(2);
  });
  it("deduplicates matching session IDs across repeated imports", () => {
    const d = fixture();
    expect(mergeData(mergeData(d, d), d).sessions).toHaveLength(1);
  });
  it("keeps both conflicting edits and allows explicit resolution", () => {
    const a = fixture(),
      b = fixture();
    b.sessions[0] = { ...b.sessions[0], note: "Cloud", updatedAt: NOW + 1 };
    const merged = mergeData(a, b);
    expect(merged.sessions[0].note).toBe("Cloud");
    const c = merged.conflicts.find((c) => c.collection === "sessions")!;
    expect(c).toBeDefined();
    const resolved = resolveConflict(merged, c, true, NOW + 10);
    expect(resolved.sessions[0].note).toBe("Тэгшитгэл");
    expect(resolved.conflicts[0].resolvedAt).toBe(NOW + 10);
  });
  it("uses the common ancestor to distinguish independent edits", () => {
    const base = fixture(),
      local = fixture(),
      remote = fixture();
    remote.sessions[0] = {
      ...remote.sessions[0],
      note: "Only remote",
      updatedAt: NOW + 1,
    };
    const merged = mergeData(local, remote, base);
    expect(merged.sessions[0].note).toBe("Only remote");
    expect(merged.conflicts).toHaveLength(0);
  });
  it("does not resurrect a deleted session from a stale device", () => {
    const a = fixture(),
      b = fixture();
    a.sessions[0] = {
      ...a.sessions[0],
      deletedAt: NOW + 1,
      updatedAt: NOW + 1,
    };
    expect(mergeData(a, b).sessions[0].deletedAt).toBe(NOW + 1);
  });
  it("maps same-name subjects while preserving alias metadata and stable round trips", () => {
    const a = fixture(),
      b = fixture();
    b.subjects = [
      { ...subject("alias", "Математик"), extras: { source: "other" } },
    ];
    b.sessions = [session({ id: "other", subjectId: "alias" })];
    const once = mergeData(a, b),
      twice = mergeData(once, once, once);
    expect(once.subjects.filter((s) => !s.deletedAt)).toHaveLength(1);
    expect(once.subjects.find((s) => s.id === "alias")?.extras.source).toBe(
      "other",
    );
    expect(once.sessions.find((s) => s.id === "other")?.subjectId).toBe("math");
    expect(twice).toEqual(once);
  });
  it("equivalent manual entries count one day and can be unmarked together", () => {
    const a = fixture();
    a.sessions = [];
    a.entries = [
      {
        id: "e1",
        subjectId: "math",
        date: "2026-09-14",
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        extras: {},
      },
      {
        id: "e2",
        subjectId: "math",
        date: "2026-09-14",
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        extras: {},
      },
    ];
    expect(buildIndex(a).days.size).toBe(1);
    expect(buildIndex(actions.markDay("math", "2026-09-14")(a)).days.size).toBe(
      0,
    );
  });
});
