// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { fixture, NOW } from "./fixtures";
import { startTimer, pause } from "@/lib/calculations/timer";
import type { StudyData } from "@/types/study";
import { countdownSecond, timerChime, timerDesign } from "@/lib/timer-alerts";
import { TimerWatch, StudyTimer } from "@/components/timer/study-timer";
import { TimerSoundSettings } from "@/components/settings/timer-sound-settings";

const sounds = vi.hoisted(() => ({
  enableSound: vi.fn().mockResolvedValue(undefined),
  playTimerComplete: vi.fn().mockResolvedValue(undefined),
  playTimerCountdown: vi.fn().mockResolvedValue(undefined),
  notifyTimerWarning: vi.fn().mockResolvedValue(undefined),
  notifyUser: vi.fn().mockResolvedValue(undefined),
  stopTimerAlertSound: vi.fn(),
  testTimerNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => sounds);
let data: StudyData;
let now: number;
const navigate = vi.fn();
const setNotice = vi.fn();
const store = {
  getSnapshot: () => ({ data, namespace: "local" }),
  mutate: async (transform: (d: StudyData) => StudyData) => {
    data = transform(data);
  },
};
const run = async (task: () => Promise<unknown>) => {
  await task();
  return true;
};
vi.mock("@/hooks/use-study", () => ({
  useStudy: () => ({
    data,
    store,
    run,
    navigate,
    setNotice,
    index: { subjects: new Map(data.subjects.map((s) => [s.id, s])) },
  }),
  useClock: () => now,
  useStoreState: () => ({ busy: false }),
}));
beforeEach(() => {
  data = fixture();
  now = NOW;
  data.activeTimer = startTimer("math", "pomodoro", "focus", 1, NOW);
  data.settings.extras.timerWarningSeconds = 0;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("counts 10 through 1 once per second and Stop silences the rest of this countdown", () => {
  const view = render(<TimerWatch />);
  for (let second = 10; second >= 4; second--) {
    now = NOW + 60000 - second * 1000;
    view.rerender(<TimerWatch />);
    expect(screen.getByText(`${second} секунд үлдлээ`)).toBeInTheDocument();
    view.rerender(<TimerWatch />);
  }
  expect(sounds.playTimerCountdown).toHaveBeenCalledTimes(7);
  fireEvent.click(screen.getByRole("button", { name: /Тооллын дууг зогсоох/ }));
  expect(sounds.stopTimerAlertSound).toHaveBeenCalled();
  now += 1000;
  view.rerender(<TimerWatch />);
  expect(screen.getByText("3 секунд үлдлээ")).toBeInTheDocument();
  expect(sounds.playTimerCountdown).toHaveBeenCalledTimes(7);
});

it("auto-completes from the deadline timeout without requiring another render", async () => {
  now = NOW + 60000;
  render(<TimerWatch />);
  await waitFor(() => expect(data.activeTimer?.status).toBe("review"));
  await waitFor(() => expect(sounds.notifyUser).toHaveBeenCalledOnce());
});

it("finishes once, displays Stop first, and stops audio when dismissed", async () => {
  now = NOW + 60000;
  const view = render(<TimerWatch />);
  const dialog = await screen.findByRole("dialog", { name: "Хугацаа дууслаа!" });
  expect(within(dialog).getAllByRole("button")[0]).toHaveTextContent(
    "Дууг зогсоох",
  );
  expect(sounds.notifyUser).toHaveBeenCalledOnce();
  fireEvent.click(within(dialog).getByRole("button", { name: /Дууг зогсоох/ }));
  expect(sounds.stopTimerAlertSound).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<TimerWatch />);
  expect(sounds.notifyUser).toHaveBeenCalledOnce();
  expect(data.activeTimer?.status).toBe("review");
});

it("Escape and View result both silence the alert", async () => {
  now = NOW + 60000;
  const view = render(<TimerWatch />);
  await screen.findByRole("dialog");
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(sounds.stopTimerAlertSound).toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.unmount();
  data.activeTimer = startTimer("math", "pomodoro", "focus", 1, NOW);
  render(<TimerWatch />);
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Үр дүнгээ харах" }));
  expect(navigate).toHaveBeenCalledWith("focus");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("skips missed ticks after suspension and resets countdown for another timer", () => {
  const view = render(<TimerWatch />);
  now = NOW + 58000;
  view.rerender(<TimerWatch />);
  expect(sounds.playTimerCountdown).toHaveBeenCalledTimes(1);
  expect(sounds.playTimerCountdown).toHaveBeenLastCalledWith(data.settings, 2);
  fireEvent.click(screen.getByRole("button", { name: /Тооллын дууг зогсоох/ }));
  data.activeTimer = startTimer("math", "pomodoro", "focus", 1, now);
  view.rerender(<TimerWatch />);
  now += 50000;
  view.rerender(<TimerWatch />);
  expect(sounds.playTimerCountdown).toHaveBeenLastCalledWith(data.settings, 10);
});

it("finishes a countdown when Pause is clicked after its deadline", async () => {
  now = NOW + 60000;
  data.sessions = [];
  const view = render(<StudyTimer />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await act(async () => {});
  expect(data.activeTimer?.status).toBe("review");
  expect(data.sessions).toHaveLength(1);
  expect(data.sessions[0].durationSec).toBe(60);
  view.unmount();
});

it("pausing stops countdown audio and warning dialog; stopwatch has no countdown", () => {
  now = NOW + 50000;
  const view = render(<TimerWatch />);
  data.activeTimer = pause(data.activeTimer!, now);
  view.rerender(<TimerWatch />);
  expect(sounds.stopTimerAlertSound).toHaveBeenCalled();
  expect(screen.queryByLabelText("Сүүлийн 10 секунд")).not.toBeInTheDocument();
  data.activeTimer = startTimer("math", "stopwatch", "focus", null, now);
  view.rerender(<TimerWatch />);
  expect(screen.queryByLabelText("Сүүлийн 10 секунд")).not.toBeInTheDocument();
});

it("warning popup shows the live countdown, and offers a sound stop button", () => {
  data.settings.extras.timerWarningSeconds = 10;
  now = NOW + 50000;
  const view = render(<TimerWatch />);
  expect(
    screen.getByRole("dialog", { name: "10 секунд үлдлээ!" }),
  ).toBeInTheDocument();
  now += 1000;
  view.rerender(<TimerWatch />);
  expect(
    screen.getByRole("dialog", { name: "9 секунд үлдлээ!" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Дууг зогсоох/ }));
  expect(sounds.stopTimerAlertSound).toHaveBeenCalled();
});

it("resets task completion choice when a new timer starts", async () => {
  data.tasks = [
    {
      id: "task-1",
      subjectId: "math",
      date: "2026-09-15",
      title: "Жишээ бодох",
      minutes: 25,
      startTime: null,
      goalId: null,
      completed: false,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      extras: {},
    },
  ];
  data.activeTimer = {
    ...startTimer("math", "pomodoro", "focus", 1, NOW, "task-1"),
  };

  const view = render(<StudyTimer />);
  const checkbox = screen.getByRole("checkbox", {
    name: "Хадгалаад төлөвлөгөөг биелсэнд тооцох",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);

  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);

  data.activeTimer = null;
  view.rerender(<StudyTimer />);
  data.activeTimer = startTimer("math", "pomodoro", "focus", 1, NOW + 1000, "task-1");
  view.rerender(<StudyTimer />);

  await act(async () => {});
  expect(
    (screen.getByRole("checkbox", {
      name: "Хадгалаад төлөвлөгөөг биелсэнд тооцох",
    }) as HTMLInputElement).checked,
  ).toBe(true);
});

it("saves chime, design and countdown preferences without changing study records", async () => {
  data.activeTimer = null;
  const subjects = JSON.stringify(data.subjects),
    sessions = JSON.stringify(data.sessions);
  const view = render(<TimerSoundSettings />);
  await act(async () =>
    fireEvent.change(screen.getByLabelText("Дуусах аялгуу"), {
      target: { value: "calm" },
    }),
  );
  await act(async () =>
    fireEvent.change(screen.getByLabelText("Таймерын загвар"), {
      target: { value: "digital" },
    }),
  );
  await act(async () =>
    fireEvent.click(screen.getByLabelText("Сүүлийн 10 секундыг томоор тоолох")),
  );
  view.unmount();
  render(<TimerSoundSettings />);
  expect(screen.getByLabelText("Дуусах аялгуу")).toHaveValue("calm");
  expect(screen.getByLabelText("Таймерын загвар")).toHaveValue("digital");
  expect(
    screen.getByLabelText("Сүүлийн 10 секундыг томоор тоолох"),
  ).not.toBeChecked();
  expect(JSON.stringify(data.subjects)).toBe(subjects);
  expect(JSON.stringify(data.sessions)).toBe(sessions);
  fireEvent.click(screen.getByRole("button", { name: /Аялгууг турших/ }));
  expect(sounds.playTimerComplete).toHaveBeenCalledWith(
    expect.objectContaining({ sound: true }),
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: /Дууг зогсоох/ }));
  expect(sounds.stopTimerAlertSound).toHaveBeenCalled();
});

it.each(["ring", "digital", "minimal"])(
  "renders %s with the same remaining time and timer state",
  (design) => {
    data.settings.extras.timerDesign = design;
    now = NOW + 59001;
    const timer = data.activeTimer;
    const view = render(<StudyTimer />);
    expect(
      view.container.querySelector(`.timer-design-${design}`),
    ).toBeTruthy();
    expect(screen.getByLabelText("Хугацаа")).toHaveTextContent("00:01");
    expect(data.activeTimer).toBe(timer);
  },
);

it("normalizes unknown saved settings and countdown boundaries", () => {
  data.settings.extras.timerDesign = "broken";
  data.settings.extras.timerChime = [];
  expect(timerDesign(data.settings)).toBe("ring");
  expect(timerChime(data.settings).id).toBe("warm");
  expect(countdownSecond(10001)).toBeNull();
  expect(countdownSecond(10000)).toBe(10);
  expect(countdownSecond(1)).toBe(1);
  expect(countdownSecond(0)).toBeNull();
  expect(countdownSecond(-1)).toBeNull();
});
