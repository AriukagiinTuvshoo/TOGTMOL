import { describe, it, expect, vi, afterEach } from "vitest";
import {
  elapsed,
  pause,
  resume,
  review,
  sessionFromTimer,
  snapshotForExport,
  startTimer,
} from "@/lib/calculations/timer";
import { actions } from "@/lib/persistence/actions";
import { fixture, NOW } from "./fixtures";
afterEach(() => vi.restoreAllMocks());
describe("timer lifecycle", () => {
  it("excludes pauses and preserves the original start through repeated resumes", () => {
    let t = startTimer("math", "stopwatch", "focus", null, NOW);
    t = pause(t, NOW + 10000);
    t = resume(t, NOW + 40000);
    t = pause(t, NOW + 50000);
    t = resume(t, NOW + 70000);
    t = review(t, NOW + 90000);
    const s = sessionFromTimer(t, " тэмдэглэл ", NOW + 100000);
    expect(s.durationSec).toBe(40);
    expect(s.startEpoch).toBe(NOW);
    expect(s.endEpoch).toBe(NOW + 90000);
    expect(s.note).toBe("тэмдэглэл");
    expect(s.segments).toHaveLength(3);
  });
  it("uses real timestamps after refresh without needing ticks", () => {
    const t = startTimer("math", "stopwatch", "focus", null, NOW),
      restored = JSON.parse(JSON.stringify(t));
    expect(elapsed(restored, NOW + 300000)).toBe(300000);
  });
  it("clamps late Pomodoro completion to its exact deadline", () => {
    const t = review(
      startTimer("math", "pomodoro", "focus", 25, NOW),
      NOW + 3 * 3600000,
    );
    expect(t.finishedAt).toBe(NOW + 1500000);
    expect(sessionFromTimer(t, "", NOW + 3 * 3600000).durationSec).toBe(1500);
  });
  it("preserves the actual end time when Finish is pressed long after pausing", () => {
    let t = startTimer("math", "stopwatch", "focus", null, NOW);
    t = pause(t, NOW + 10000);
    t = review(t, NOW + 3600000);
    expect(t.finishedAt).toBe(NOW + 10000);
    expect(sessionFromTimer(t, "", NOW + 3600000).endEpoch).toBe(NOW + 10000);
  });

  it("moves the deadline correctly around a Pomodoro pause", () => {
    let t = pause(
      startTimer("math", "pomodoro", "focus", 25, NOW),
      NOW + 600000,
    );
    t = resume(t, NOW + 1200000);
    t = review(t, NOW + 3600000);
    expect(t.finishedAt).toBe(NOW + 2100000);
    expect(t.accumulatedMs).toBe(1500000);
  });
  it("never counts breaks as study sessions", () => {
    const t = review(
      startTimer("math", "pomodoro", "shortBreak", 5, NOW),
      NOW + 300000,
    );
    expect(() => sessionFromTimer(t, "", NOW)).toThrow();
  });
  it("keeps a finished review across reload until explicitly saved", () => {
    const d = fixture();
    d.activeTimer = review(
      startTimer("math", "stopwatch", "focus", null, NOW),
      NOW + 10000,
    );
    const reloaded = JSON.parse(JSON.stringify(d));
    expect(reloaded.sessions).toHaveLength(1);
    const saved = actions.saveTimer("Result", false)(reloaded);
    expect(saved.sessions).toHaveLength(2);
    expect(saved.activeTimer).toBeNull();
    expect(saved.sessions[1].note).toBe("Result");
  });
  it("records a partially stopped focus session immediately for statistics", () => {
    const d = fixture();
    d.sessions = [];
    d.activeTimer = startTimer("math", "stopwatch", "focus", null, NOW);
    vi.spyOn(Date, "now").mockReturnValue(NOW + 2300);
    const stopped = actions.finish()(d);
    expect(stopped.activeTimer?.status).toBe("review");
    expect(stopped.sessions).toHaveLength(1);
    expect(stopped.sessions[0].subjectId).toBe("math");
    expect(stopped.sessions[0].durationSec).toBeGreaterThanOrEqual(1);
  });

  it("updates the already-recorded session when the review note is saved", () => {
    const d = fixture();
    const timer = startTimer("math", "stopwatch", "focus", null, NOW);
    const reviewed = review(timer, NOW + 30000);
    d.activeTimer = reviewed;
    d.sessions = [
      session({
        id: reviewed.id,
        startEpoch: reviewed.sessionStartedAt,
        endEpoch: NOW + 30000,
        durationSec: 30,
        segments: reviewed.segments,
      }),
    ];

    const saved = actions.saveTimer("тайлбар", false)(d);
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0].id).toBe(reviewed.id);
    expect(saved.sessions[0].note).toBe("тайлбар");
    expect(saved.sessions[0].durationSec).toBe(30);
  });

  it("rejects double start and sub-zero sessions", () => {
    const d = fixture();
    d.activeTimer = startTimer("math", "stopwatch", "focus", null, NOW);
    expect(() =>
      actions.start("math", "stopwatch", "focus", null)(d),
    ).toThrow();
    expect(() =>
      sessionFromTimer(review(d.activeTimer!, NOW), "", NOW),
    ).toThrow();
  });
  it("exports a paused snapshot without changing the live timer", () => {
    const d = fixture();
    d.activeTimer = startTimer("math", "stopwatch", "focus", null, NOW);
    const exported = snapshotForExport(d, NOW + 50000);
    expect(exported.activeTimer?.running).toBe(false);
    expect(exported.activeTimer?.accumulatedMs).toBe(50000);
    expect(d.activeTimer.running).toBe(true);
  });
  it("saving the same review again cannot duplicate its session", () => {
    const d = fixture(),
      t = review(
        startTimer("math", "stopwatch", "focus", null, NOW),
        NOW + 10000,
      );
    d.activeTimer = t;
    const a = actions.saveTimer("", false)(d);
    a.activeTimer = t;
    expect(actions.saveTimer("", false)(a).sessions).toHaveLength(2);
  });
});
