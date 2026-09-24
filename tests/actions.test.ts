import { describe, expect, it, vi, afterEach } from "vitest";
import { actions } from "@/lib/persistence/actions";
import { fixture, subject } from "./fixtures";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("persistence action guards", () => {
  it("prevents renaming a subject to an existing active subject", () => {
    const data = fixture();
    data.subjects.push(subject("physics", "Физик"));

    expect(() =>
      actions.editSubject("math", {
        name: "  физик  ",
        color: "#e6c75a",
        archived: false,
      })(data),
    ).toThrow("Ийм нэртэй хичээл байна.");
  });

  it("uses the configured study day when marking days near midnight", () => {
    const now = new Date(2026, 8, 23, 2, 0, 0).getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const base = fixture();
    const data = {
      ...base,
      settings: {
        ...base.settings,
        extras: {
          ...base.settings.extras,
          studyDayBoundary: 4,
        },
      },
    };

    expect(() => actions.markDay("math", "2026-09-23")(data)).toThrow(
      "Ирээдүйн өдрийг суралцсан гэж тэмдэглэх боломжгүй.",
    );
    expect(() => actions.markDay("math", "2026-09-22")(data)).not.toThrow();
  });

  it("uses the configured study day when editing a session near midnight", () => {
    const now = new Date("2026-09-23T02:00:00").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const base = fixture();
    const data = {
      ...base,
      settings: {
        ...base.settings,
        extras: {
          ...base.settings.extras,
          studyDayBoundary: 4,
        },
      },
    };
    const expected = data.sessions[0].updatedAt;

    expect(() =>
      actions.editSession(
        data.sessions[0].id,
        { note: "засвар", date: "2026-09-23", durationSec: 60 },
        expected,
      )(data),
    ).toThrow("Огноо эсвэл хугацаа буруу.");

    expect(() =>
      actions.editSession(
        data.sessions[0].id,
        { note: "засвар", date: "2026-09-22", durationSec: 60 },
        expected,
      )(data),
    ).not.toThrow();
  });

  it("normalizes an explicitly undefined task goalId to null", () => {
    const data = actions.addTask({
      subjectId: "math",
      date: "2026-09-15",
      minutes: 25,
      title: "Жишээ бодох",
      startTime: null,
      goalId: undefined,
    })(fixture());

    expect(data.tasks[0].goalId).toBeNull();
  });
});
