import type { Settings } from "@/types/study";
import { completionVolume } from "./preferences";
import { timerChime } from "./timer-alerts";

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;
let titleFlashTimer: number | null = null;
let originalTitle: string | null = null;
let generation = 0;
let countdownRequest = 0;
const visibleNotifications = new Set<Notification>();
const activeTones = new Set<{ tone: OscillatorNode; gain: GainNode }>();

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ?? (window as WebkitWindow).webkitAudioContext ?? null
  );
}

export async function enableSound() {
  const AudioCtor = getAudioContextCtor();
  if (!AudioCtor) throw Error("Энэ браузер дууны дохио дэмжихгүй.");
  audioContext ??= new AudioCtor();
  if (audioContext.state === "suspended") await audioContext.resume();
  if (audioContext.state !== "running")
    throw Error("Браузер дууны сувгийг идэвхжүүлж чадсангүй.");
}

async function ensureAudioReady() {
  if (!audioContext) await enableSound();
  else if (audioContext.state === "suspended") await audioContext.resume();
  if (!audioContext || audioContext.state !== "running")
    throw Error("Дууны суваг идэвхгүй байна.");
}

function scheduleTone(
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  if (!audioContext) return;
  const tone = audioContext.createOscillator();
  const gain = audioContext.createGain();
  tone.type = type;
  tone.frequency.value = frequency;
  tone.connect(gain);
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.018);
  gain.gain.setValueAtTime(volume, start + Math.max(0.025, duration - 0.06));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  activeTones.add({ tone, gain });
  tone.start(start);
  tone.stop(start + duration);
  tone.onended = () => {
    activeTones.forEach((entry) => {
      if (entry.tone === tone) activeTones.delete(entry);
    });
    tone.disconnect();
    gain.disconnect();
  };
}

export function stopTimerAlertSound() {
  // Invalidate pending resume() calls as well as already scheduled notes.
  generation += 1;
  safeVibrate(0);
  if (titleFlashTimer !== null) window.clearInterval(titleFlashTimer);
  titleFlashTimer = null;
  if (originalTitle !== null && typeof document !== "undefined")
    document.title = originalTitle;
  originalTitle = null;
  for (const notification of visibleNotifications) {
    try {
      notification.close();
    } catch {
      /* Optional browser API. */
    }
  }
  visibleNotifications.clear();
  const now = audioContext?.currentTime ?? 0;
  for (const { tone, gain } of activeTones) {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      tone.stop(now);
    } catch {
      /* A scheduled node may already have ended. */
    }
    try {
      tone.disconnect();
      gain.disconnect();
    } catch {
      /* Already detached. */
    }
  }
  activeTones.clear();
}

function safeVibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator)
      navigator.vibrate(pattern);
  } catch {
    /* Vibration is optional. */
  }
}

function flashTitle(message: string, cycles = 7) {
  if (typeof document === "undefined") return;
  if (titleFlashTimer !== null) window.clearInterval(titleFlashTimer);
  originalTitle ??= document.title;
  const original = originalTitle;
  let step = 0;
  document.title = message;
  titleFlashTimer = window.setInterval(() => {
    step += 1;
    document.title = step % 2 === 0 ? message : original;
    if (step >= cycles * 2) {
      window.clearInterval(titleFlashTimer!);
      titleFlashTimer = null;
      document.title = original;
      originalTitle = null;
    }
  }, 500);
}

async function showBrowserNotification(
  message: string,
  settings: Settings,
  tag: string,
  title = "Тогтмол",
) {
  if (
    !settings.notifications ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  const request = generation;
  const options: NotificationOptions = {
    body: message,
    icon: "/icons/icon-192.png",
    tag,
    requireInteraction: true,
    // In the background allow the OS's normal notification sound.
    // Web notifications cannot select our custom in-page melody.
    silent:
      !settings.sound ||
      completionVolume(settings) === 0 ||
      document.visibilityState === "visible",
    data: { timerAlert: true },
  };
  try {
    const reg =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    if (request !== generation) return;
    if (reg?.active) {
      await reg.showNotification(title, options);
      if (request !== generation) {
        const notifications = await reg.getNotifications({ tag });
        notifications.forEach((notification) => notification.close());
      }
    } else {
      const notification = new Notification(title, options);
      visibleNotifications.add(notification);
      notification.onclose = () => visibleNotifications.delete(notification);
    }
  } catch {
    /* Notifications must not prevent timer completion. */
  }
}

export async function playTimerWarning(settings: Settings) {
  stopTimerAlertSound();
  const request = generation;
  if (settings.extras.timerVibration !== false) safeVibrate([180, 90, 180]);
  if (!settings.sound || completionVolume(settings) <= 0) return;
  try {
    await ensureAudioReady();
    if (request !== generation) return;
    const now = audioContext!.currentTime;
    const volume = completionVolume(settings) * 0.25;
    const notes = timerChime(settings).notes;
    scheduleTone(notes[0], now, 0.3, volume);
    scheduleTone(notes[1], now + 0.34, 0.3, volume);
    scheduleTone(notes[2], now + 0.68, 0.42, volume);
  } catch {
    /* Audio failure is local to the alert. */
  }
}

export async function playTimerCountdown(settings: Settings, second: number) {
  if (!Number.isInteger(second) || second < 1 || second > 10) return;
  const tick = ++countdownRequest;
  const expires = Date.now() + 500;
  if (
    !settings.sound ||
    settings.extras.timerCountdownSound === false ||
    completionVolume(settings) <= 0
  )
    return;
  const request = generation;
  try {
    await ensureAudioReady();
    if (
      request !== generation ||
      tick !== countdownRequest ||
      Date.now() > expires
    )
      return;
    scheduleTone(
      second <= 3 ? 880 : 659.25,
      audioContext!.currentTime,
      0.12,
      completionVolume(settings) * 0.15,
    );
  } catch {
    /* Countdown remains visible if audio is unavailable. */
  }
}

export async function playTimerComplete(settings: Settings, preview = false) {
  stopTimerAlertSound();
  const request = generation;
  if (settings.extras.timerVibration !== false)
    safeVibrate([300, 90, 300, 90, 420, 140, 420]);
  if (!preview) flashTitle("⏰ Хугацаа дууслаа!", 10);
  if (!settings.sound || completionVolume(settings) <= 0) return false;
  try {
    await ensureAudioReady();
    if (request !== generation) return false;
    const now = audioContext!.currentTime;
    const volume = completionVolume(settings) * 0.4;
    const notes = timerChime(settings).notes;
    for (let repeat = 0; repeat < 3; repeat++) {
      const base = now + repeat * 3.15;
      notes.forEach((frequency, index) => {
        scheduleTone(
          frequency,
          base + index * 0.43,
          index === 4 ? 0.75 : 0.4,
          volume,
        );
      });
    }
    return true;
  } catch {
    /* Audio failure must not block timer completion or notification. */
    return false;
  }
}

export async function notifyUser(
  message: string,
  settings: Settings,
  tag = "togtmol-reminder",
) {
  // Notification delivery must not wait for a suspended audio context.
  await Promise.all([
    playTimerComplete(settings),
    showBrowserNotification(message, settings, tag, "Тогтмол · Таймер"),
  ]);
}

export async function notifyTimerWarning(
  message: string,
  settings: Settings,
  tag = "togtmol-timer-warning",
) {
  await Promise.all([
    playTimerWarning(settings),
    showBrowserNotification(message, settings, tag, "Тогтмол · Сануулга"),
  ]);
}

export async function testTimerNotification(settings: Settings) {
  if (typeof Notification === "undefined")
    throw Error(
      "Энэ браузер мэдэгдэл дэмжихгүй. iPhone дээр Safari-аас үндсэн дэлгэцдээ нэмээд нээнэ үү.",
    );
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted")
    throw Error("Мэдэгдлийн зөвшөөрөл олгогдсонгүй.");
  await showBrowserNotification(
    "Таймерын мэдэгдлийн туршилт. Энэ нь түгжээтэй үед товлосон дохиог батлахгүй.",
    { ...settings, notifications: true },
    "togtmol-timer-test",
  );
}
