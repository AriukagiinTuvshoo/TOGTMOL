import { describe, expect, it, vi, afterEach } from "vitest";
import { actions } from "@/lib/persistence/actions";
import { weekStart } from "@/lib/calculations/dates";
import {
  calendarTimeZone,
  deadlineEpoch,
  readCalendarDeadlines,
} from "@/lib/calculations/calendar";
import { fixture } from "./fixtures";

afterEach(() => vi.restoreAllMocks());

describe("calendar planning", () => {
  it("supports Monday and Sunday week starts", () => {
    expect(weekStart("2026-09-20", "monday")).toBe("2026-09-14");
    expect(weekStart("2026-09-20", "sunday")).toBe("2026-09-20");
  });

  it("creates a recurring Monday/Tuesday study schedule", () => {
    const data = actions.addRecurringTasks({
      subjectId: "math",
      title: "Япон хэл давтах",
      startDate: "2026-09-14",
      endDate: "2026-09-20",
      weekdays: [1, 2],
      startTime: "19:00",
      minutes: 50,
    })(fixture());
    expect(data.tasks.filter((t) => t.extras.seriesId)).toHaveLength(2);
    expect(data.tasks.every((t) => t.startTime === "19:00")).toBe(true);
    expect(
      data.tasks.every(
        (t) =>
          t.extras.recurrence &&
          typeof t.extras.recurrence === "object",
      ),
    ).toBe(true);
  });

  it("creates and removes a deadline without touching sessions", () => {
    const base = fixture();
    const added = actions.addDeadline({
      title: "N2 mock test",
      subjectId: "math",
      date: "2026-10-10",
      time: "09:30",
      notes: "Room A",
    })(base);
    const deadlines = readCalendarDeadlines(added);
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatchObject({
      title: "N2 mock test",
      date: "2026-10-10",
      time: "09:30",
    });
    expect(deadlineEpoch(deadlines[0], "Asia/Tokyo")).toBe(
      new Date("2026-10-10T09:30:00+09:00").getTime(),
    );
    const removed = actions.deleteDeadline(deadlines[0].id)(added);
    expect(readCalendarDeadlines(removed).filter((d) => !d.deletedAt)).toHaveLength(0);
    expect(removed.sessions).toEqual(base.sessions);
  });

  it("moves a session to a new study day and preserves its local clock time", () => {
    const base = fixture();
    const expected = base.sessions[0].updatedAt;
    const data = {
      ...base,
      settings: {
        ...base.settings,
        extras: { ...base.settings.extras, timeZone: "Asia/Tokyo" },
      },
    };
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-09-20T08:00:00+09:00").getTime(),
    );
    const moved = actions.moveSession(
      base.sessions[0].id,
      "2026-09-19",
      expected,
    )(data);
    expect(moved.sessions[0].date).toBe("2026-09-19");
    expect(new Date(moved.sessions[0].startEpoch).toLocaleTimeString("en-US", {
      timeZone: calendarTimeZone(moved),
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })).toBe(
      new Date(base.sessions[0].startEpoch).toLocaleTimeString("en-US", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
    expect(moved.sessions[0].manuallyEdited).toBe(true);
  });
});
