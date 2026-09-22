import { afterEach, describe, expect, it, vi } from "vitest";
import { knowledgeFixture, note, card, quiz } from "./knowledge-fixtures";
import { NOW, session } from "./fixtures";
import { migrate } from "@/lib/migration/migrate";
import { mergeData } from "@/lib/migration/merge";
import { sm2 } from "@/lib/knowledge/spaced-repetition";
import {
  reviewCard,
  saveKnowledge,
  removeKnowledge,
  gradeQuiz,
  saveQuizAttempt,
} from "@/lib/knowledge/actions";
import {
  knowledgeIndex,
  searchableData,
  searchResults,
} from "@/lib/knowledge/index";
import { safeLink, imageData } from "@/lib/knowledge/validation";
import { localCardDrafts, parseCardDrafts } from "@/lib/knowledge/generation";
import { knowledgeStatistics } from "@/lib/knowledge/statistics";
import { studyDate, flexibleStreak } from "@/lib/calculations/dates";
import { reminderMessage } from "@/lib/reminders";
import { parsePlanProposal } from "@/lib/assistant/plan";
import { unlock } from "@/lib/calculations/achievements";
import { buildIndex } from "@/lib/calculations/analytics";
afterEach(() => vi.restoreAllMocks());
describe("v5 knowledge preservation and search", () => {
  it("round-trips image, note, card, quiz and links with IDs, metadata and unknown fields", () => {
    const data = knowledgeFixture();
    data.knowledge[0].extras.future = { nested: true };
    const imported = migrate({ app: "togtmol", version: 5, data });
    expect(imported.knowledge).toEqual(data.knowledge);
    expect(migrate(imported)).toEqual(imported);
    expect(data.knowledge[0]).toEqual(noteWithExtra());
    function noteWithExtra() {
      return { ...note(), extras: { future: { nested: true } } };
    }
  });
  it("retains both concurrent edits and deletion conflicts, deduplicates repeated imports and remaps subject aliases", () => {
    const base = knowledgeFixture(),
      left = structuredClone(base),
      right = structuredClone(base);
    left.knowledge[0].title = "Локал засвар";
    left.knowledge[0].updatedAt = NOW + 1;
    right.knowledge[0].title = "Нөгөө төхөөрөмж";
    right.knowledge[0].updatedAt = NOW + 2;
    const merged = mergeData(left, right, base);
    expect(merged.conflicts).toHaveLength(1);
    expect(merged.conflicts[0]).toMatchObject({
      collection: "knowledge",
      other: left.knowledge[0],
    });
    expect(mergeData(merged, right).knowledge).toHaveLength(
      base.knowledge.length,
    );
    const deleted = removeKnowledge("note-1")(base);
    expect(
      mergeData(deleted, right, base).conflicts.some(
        (c) => c.collection === "knowledge",
      ),
    ).toBe(true);
    right.subjects[0].id = "other-math";
    right.knowledge.forEach((r) => (r.subjectId = "other-math"));
    expect(
      mergeData(left, right).knowledge.every((r) => r.subjectId === "math"),
    ).toBe(true);
  });
  it("preserves invalid image/URL rows in quarantine and recovers missing subject references", () => {
    const data = knowledgeFixture(),
      raw = structuredClone(data);
    (raw.knowledge[0] as ReturnType<typeof note>).image =
      "data:image/svg+xml,<svg onload=alert(1)>";
    raw.knowledge[1].subjectId = "recovered-subject";
    const next = migrate(raw);
    expect(next.quarantine[0].value).toEqual(raw.knowledge[0]);
    expect(
      next.subjects.find((s) => s.id === "recovered-subject")?.archived,
    ).toBe(true);
    expect(() => safeLink("javascript:alert(1)")).toThrow();
    expect(() => safeLink("https://user:secret@example.org")).toThrow();
    expect(() => imageData("https://tracker.example/pixel.png")).toThrow();
  });
  it("searches full note/card text, tags, dates, subjects and session notes; excludes trash", () => {
    const data = knowledgeFixture(),
      index = searchableData(data);
    expect(searchResults(index, "ҮЛ МЭДЭГДЭХ")[0].id).toBe("note-1");
    expect(searchResults(index, "x = 2", { type: "card" })[0].id).toBe(
      "card-1",
    );
    expect(
      searchResults(index, "", {
        tag: "алгебр",
        subjectId: "math",
        from: "2026-09-15",
        to: "2026-09-15",
      }),
    ).toHaveLength(5);
    expect(searchResults(index, "Тэгшитгэл", { type: "session" })).toHaveLength(
      1,
    );
    expect(
      searchResults(
        searchableData(removeKnowledge("note-1")(data)),
        "Үл мэдэгдэх",
      ),
    ).toHaveLength(0);
  });
  it("rejects stale edits and keeps deck deletion reversible without losing cards", () => {
    const data = knowledgeFixture();
    expect(() =>
      saveKnowledge({ ...note(), title: "Засвар" }, -1)(data),
    ).toThrow();
    const next = removeKnowledge("deck-1")(data);
    expect(knowledgeIndex(next.knowledge, "2026-09-15").cards).toHaveLength(0);
    expect(next.knowledge.find((r) => r.id === "card-1")).toEqual(card());
  });
});
describe("retrieval practice", () => {
  it("implements SM-2 intervals, ease floor and failure restart", () => {
    let schedule = card().schedule;
    schedule = sm2(schedule, 4, "2026-09-15");
    expect(schedule).toMatchObject({
      interval: 1,
      repetitions: 1,
      dueOn: "2026-09-16",
      ease: 2.5,
    });
    schedule = sm2(schedule, 4, "2026-09-16");
    expect(schedule).toMatchObject({
      interval: 6,
      repetitions: 2,
      dueOn: "2026-09-22",
    });
    schedule = sm2(schedule, 4, "2026-09-22");
    expect(schedule.interval).toBe(15);
    schedule = sm2(schedule, 0, "2026-10-07");
    expect(schedule).toMatchObject({ interval: 1, repetitions: 0 });
    for (let i = 0; i < 10; i++) schedule = sm2(schedule, 0, "2026-10-07");
    expect(schedule.ease).toBe(1.3);
    expect(() => sm2(schedule, 6, "2026-09-15")).toThrow();
  });
  it("persists every retry without advancing multiple days or accepting a duplicate/stale click", () => {
    let data = knowledgeFixture();
    data = reviewCard("card-1", 2, NOW, NOW + 1, "r1", "2026-09-15")(data);
    expect(
      reviewCard("card-1", 2, NOW, NOW + 1, "r1", "2026-09-15")(data),
    ).toBe(data);
    expect(() =>
      reviewCard("card-1", 4, NOW, NOW + 2, "r2", "2026-09-15")(data),
    ).toThrow();
    data = reviewCard("card-1", 4, NOW + 1, NOW + 2, "r2", "2026-09-15")(data);
    const active = knowledgeIndex(data.knowledge, "2026-09-15");
    expect(active.cards[0].schedule).toMatchObject({
      interval: 1,
      repetitions: 1,
    });
    expect(active.reviews).toHaveLength(2);
    expect(active.reviewQueue).toHaveLength(0);
    expect(knowledgeIndex(data.knowledge, "2026-09-16").due).toHaveLength(1);
    expect(migrate(data).knowledge).toEqual(data.knowledge);
  });
  it("keeps same-study-day retries together across civil midnight", () => {
    const late = new Date(2026, 8, 15, 23, 30).getTime(),
      early = new Date(2026, 8, 16, 1).getTime();
    let data = knowledgeFixture();
    data.settings.extras.studyDayBoundary = 4;
    data = reviewCard("card-1", 4, NOW, late, "r1")(data);
    data = reviewCard("card-1", 5, late, early, "r2")(data);
    expect(
      knowledgeIndex(data.knowledge, "2026-09-15").cards[0].schedule,
    ).toMatchObject({ interval: 1, repetitions: 1, dueOn: "2026-09-16" });
    expect(studyDate(new Date(early), 4)).toBe("2026-09-15");
  });
  it("grades choice, true/false and normalized short answers, preserves question snapshots", () => {
    const data = knowledgeFixture(),
      attempt = gradeQuiz(quiz(), { q1: "4", q2: "Үнэн", q3: "  DEF  " }, NOW);
    expect(attempt.score).toBe(2);
    const next = saveQuizAttempt(attempt, NOW)(data);
    expect(saveQuizAttempt(attempt, NOW)(next)).toBe(next);
    expect(migrate(next).knowledge.at(-1)).toEqual(attempt);
    const changed = quiz();
    changed.questions[0].answer = "5";
    expect(attempt.answers[0].question.answer).toBe("4");
    expect(() => saveQuizAttempt({ ...attempt, id: "new" }, 0)(data)).toThrow();
    const stats = knowledgeStatistics(next, "2026-09-15", "2026-09-15");
    expect(stats).toMatchObject({
      notes: 1,
      cards: 1,
      attempts: 1,
      quizAccuracy: 67,
    });
  });
  it("offers truthful offline drafts and validates AI outputs before any commit", () => {
    expect(
      localCardDrafts("Функц: Нэртэй үйлдлүүдийн багц", "Санаа", 3)[0],
    ).toMatchObject({ front: "Функц", back: "Нэртэй үйлдлүүдийн багц" });
    expect(() =>
      parseCardDrafts({ cards: [{ front: "?", back: "" }] }),
    ).toThrow();
    expect(() =>
      parsePlanProposal({ title: "Төлөвлөгөө", weeks: 999 }),
    ).toThrow();
    expect(knowledgeFixture().knowledge).toHaveLength(5);
  });
  it("awards actual card creation, retains achievements after soft deletion and supports recovery days", () => {
    let data = knowledgeFixture();
    data.knowledge.push(
      ...Array.from({ length: 99 }, (_, i) => card(`card-${i + 2}`)),
    );
    data = unlock(data, buildIndex(data, "2026-09-15"), "2026-09-15");
    expect(data.achievementsUnlocked.cards_100).toBe("2026-09-15");
    data = removeKnowledge("card-1")(data);
    expect(
      unlock(data, buildIndex(data, "2026-09-15"), "2026-09-15")
        .achievementsUnlocked.cards_100,
    ).toBe("2026-09-15");
    expect(
      flexibleStreak(
        new Set(["2026-09-12", "2026-09-13", "2026-09-15"]),
        "2026-09-15",
        1,
      ),
    ).toMatchObject({ studied: 3, recoveryDays: 1 });
  });
  it("only includes enabled reminder categories", () => {
    const data = knowledgeFixture();
    expect(reminderMessage(data, "2026-09-15")).not.toContain("карт");
    data.settings.extras.remindCards = true;
    expect(reminderMessage(data, "2026-09-15")).toContain("1 давтах карт");
  });
  it("indexes 100,000 cards and 10,000 sessions with bounded search results", () => {
    const data = knowledgeFixture();
    data.knowledge = [
      data.knowledge[1],
      ...Array.from({ length: 100000 }, (_, i) => ({
        ...card(`c-${i}`),
        front: `Concept ${i}`,
        back: `Definition ${i}`,
      })),
    ];
    data.sessions = Array.from({ length: 10000 }, (_, i) =>
      session({ id: `s-${i}` }),
    );
    const start = performance.now(),
      index = knowledgeIndex(data.knowledge, "2026-09-15"),
      search = searchableData(data);
    expect(index.fresh).toHaveLength(100000);
    expect(index.cardsByDeck.get("deck-1")).toHaveLength(100000);
    expect(
      searchResults(search, "Concept 99999", { type: "card" }),
    ).toHaveLength(1);
    expect(searchResults(search, "", {}, 40)).toHaveLength(40);
    const elapsed = performance.now() - start;
    console.log(
      `100,000 cards + 10,000 sessions: ${elapsed.toFixed(1)} ms (indexes + search)`,
    );
    expect(elapsed).toBeLessThan(5000);
  });
});
