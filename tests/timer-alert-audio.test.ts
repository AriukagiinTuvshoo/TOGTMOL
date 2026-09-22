// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { fixture } from "./fixtures";
import { COMPLETION_NOTES, countdownFrequency } from "@/lib/timer-alerts";

let nodes: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  frequency: { value: number };
  type: string;
  connect: ReturnType<typeof vi.fn>;
}[];
let gains: {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    cancelScheduledValues: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}[];
let resume: () => Promise<void>;
let suspended: boolean;
let api: typeof import("@/lib/notifications");
let vibrate: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  nodes = [];
  gains = [];
  suspended = false;
  resume = async () => {
    suspended = false;
  };
  vibrate = vi.fn();
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal(
    "AudioContext",
    class {
      get state() {
        return suspended ? "suspended" : "running";
      }
      currentTime = 10;
      destination = {};
      resume() {
        return resume();
      }
      createOscillator() {
        const node = {
          frequency: { value: 0 },
          type: "",
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        nodes.push(node);
        return node;
      }
      createGain() {
        const node = {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            cancelScheduledValues: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        gains.push(node);
        return node;
      }
    },
  );
  api = await import("@/lib/notifications");
});
afterEach(() => {
  api.stopTimerAlertSound();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["warm", "calm", "bright"])(
  "plays one gentle completion phrase for %s, then Stop disconnects every note and vibration",
  async (timerChime) => {
    const settings = fixture().settings;
    settings.sound = true;
    settings.extras = { timerChime, completionVolume: 0.5 };
    await api.playTimerComplete(settings, true);
    expect(nodes).toHaveLength(COMPLETION_NOTES.length + 2);
    expect(nodes[0].frequency.value).toBe(COMPLETION_NOTES[0]);
    expect(nodes[COMPLETION_NOTES.length - 1].frequency.value).toBe(
      COMPLETION_NOTES[COMPLETION_NOTES.length - 1],
    );
    api.stopTimerAlertSound();
    for (const node of nodes) {
      expect(node.stop).toHaveBeenLastCalledWith(10);
      expect(node.disconnect).toHaveBeenCalled();
    }
    for (const gain of gains)
      expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  },
);

it("cancels a pending audio resume before any notes can start", async () => {
  suspended = true;
  let release!: () => void;
  resume = () =>
    new Promise<void>((resolve) => {
      release = () => {
        suspended = false;
        resolve();
      };
    });
  const settings = { ...fixture().settings, sound: true };
  const pending = api.playTimerComplete(settings);
  api.stopTimerAlertSound();
  release();
  await pending;
  expect(nodes).toHaveLength(0);
  expect(vibrate).toHaveBeenLastCalledWith(0);
});

it("uses a unique rising pitch from 10 down to 1", () => {
  const frequencies = Array.from({ length: 10 }, (_, index) =>
    countdownFrequency(10 - index),
  );
  expect(new Set(frequencies).size).toBe(10);
  expect(frequencies).toEqual([...frequencies].sort((a, b) => a - b));
});

it("does not replay a backlog of countdown ticks when audio resumes", async () => {
  suspended = true;
  const releases: (() => void)[] = [];
  resume = () =>
    new Promise<void>((resolve) =>
      releases.push(() => {
        suspended = false;
        resolve();
      }),
    );
  const settings = { ...fixture().settings, sound: true };
  const first = api.playTimerCountdown(settings, 9);
  const second = api.playTimerCountdown(settings, 8);
  releases.forEach((release) => release());
  await Promise.all([first, second]);
  expect(nodes).toHaveLength(1);
});

it("stops vibration even with no audio context and restores the title", async () => {
  document.title = "Тогтмол";
  await api.playTimerComplete({ ...fixture().settings, sound: false });
  expect(nodes).toHaveLength(0);
  expect(document.title).toContain("дууслаа");
  api.stopTimerAlertSound();
  expect(document.title).toBe("Тогтмол");
  expect(vibrate).toHaveBeenLastCalledWith(0);
});

it("honors zero volume, disabled vibration and silent countdown", async () => {
  const settings = {
    ...fixture().settings,
    sound: true,
    extras: { completionVolume: 0, timerVibration: false },
  };
  await api.playTimerComplete(settings, true);
  expect(nodes).toHaveLength(0);
  expect(vibrate.mock.calls.every(([pattern]) => pattern === 0)).toBe(true);
  await api.playTimerCountdown(
    {
      ...settings,
      extras: { completionVolume: 1, timerCountdownSound: false },
    },
    5,
  );
  expect(nodes).toHaveLength(0);
});

it("delivers a notification without waiting for suspended audio and does not restart after Stop", async () => {
  suspended = true;
  let release!: () => void;
  resume = () =>
    new Promise<void>((resolve) => {
      release = () => {
        suspended = false;
        resolve();
      };
    });
  const showNotification = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal(
    "Notification",
    class {
      static permission = "granted";
    },
  );
  vi.stubGlobal("navigator", {
    vibrate,
    serviceWorker: {
      getRegistration: vi
        .fn()
        .mockResolvedValue({ active: true, showNotification }),
    },
  });
  const pending = api.notifyUser("Дууслаа", {
    ...fixture().settings,
    sound: true,
    notifications: true,
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(showNotification).toHaveBeenCalledOnce();
  api.stopTimerAlertSound();
  release();
  await pending;
  expect(nodes).toHaveLength(0);
});

it("contains missing AudioContext and notification errors", async () => {
  vi.stubGlobal("AudioContext", undefined);
  vi.stubGlobal(
    "Notification",
    class {
      static permission = "granted";
      constructor() {
        throw Error("unsupported");
      }
    },
  );
  await expect(
    api.notifyUser("Дууслаа", {
      ...fixture().settings,
      sound: true,
      notifications: true,
    }),
  ).resolves.toBeUndefined();
});
