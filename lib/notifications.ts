import type { Settings } from "@/types/study";
import { completionVolume } from "./preferences";

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;
let titleFlashTimer: number | null = null;
const activeTones = new Set<{ tone: OscillatorNode; gain: GainNode }>();

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as WebkitWindow).webkitAudioContext ??
    null
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
  if (!audioContext) return;
  const now = audioContext.currentTime;
  for (const { tone, gain } of activeTones) {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0.0001, now);
      tone.stop(now + 0.03);
    } catch {
      /* Tone may already be finished. */
    }
  }
  activeTones.clear();
  safeVibrate(0);
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
  const original = document.title;
  let step = 0;
  document.title = message;
  titleFlashTimer = window.setInterval(() => {
    step += 1;
    document.title = step % 2 === 0 ? message : original;
    if (step >= cycles * 2) {
      window.clearInterval(titleFlashTimer!);
      titleFlashTimer = null;
      document.title = original;
    }
  }, 500);
}

function showBrowserNotification(
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
  const options: NotificationOptions = {
    body: message,
    icon: "/icons/icon-192.png",
    tag,
    requireInteraction: true,
    silent: true,
  };
  if ("serviceWorker" in navigator)
    void navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (reg?.active) await reg.showNotification(title, options);
        else new Notification(title, options);
      })
      .catch(() => {});
  else
    try {
      new Notification(title, options);
    } catch {}
}

export async function playTimerWarning(settings: Settings) {
  if (!settings.sound || completionVolume(settings) <= 0) return;
  try {
    await ensureAudioReady();
    const now = audioContext!.currentTime;
    const volume = Math.max(0.025, completionVolume(settings) * 0.32);
    // Softer musical warning instead of a harsh electronic beep.
    scheduleTone(784, now, 0.3, volume, "sine");
    scheduleTone(988, now + 0.34, 0.3, volume, "sine");
    scheduleTone(1175, now + 0.68, 0.42, volume, "triangle");
    safeVibrate([180, 90, 180, 90, 260]);
  } catch {
    /* Audio is optional; a released device must not stop the timer. */
  }
}

export async function playTimerComplete(settings: Settings) {
  if (!settings.sound || completionVolume(settings) <= 0) return;
  try {
    await ensureAudioReady();
    const now = audioContext!.currentTime;
    stopTimerAlertSound();
    const volume = Math.max(0.03, completionVolume(settings) * 0.58);
    // Original musical chime: warm, bright and noticeable without the harsh siren tone.
    const pattern: Array<[number, number, number, OscillatorType]> = [
      [659, 0.0, 0.38, "sine"],
      [784, 0.38, 0.38, "sine"],
      [988, 0.76, 0.52, "triangle"],
      [1175, 1.32, 0.38, "sine"],
      [988, 1.72, 0.7, "triangle"],
    ];
    const repeats = 3;
    for (let repeat = 0; repeat < repeats; repeat++) {
      const base = now + repeat * 3.15;
      for (const [frequency, offset, duration, type] of pattern)
        scheduleTone(frequency, base + offset, duration, volume, type);
    }
    safeVibrate([300, 90, 300, 90, 420, 140, 420]);
    flashTitle("⏰ Хугацаа дууслаа!", 10);
  } catch {
    /* Audio is optional; a released device must not stop timer completion. */
  }
}

export async function notifyUser(
  message: string,
  settings: Settings,
  tag = "togtmol-reminder",
) {
  await playTimerComplete(settings);
  showBrowserNotification(message, settings, tag, "Тогтмол · Timer");
}

export async function notifyTimerWarning(
  message: string,
  settings: Settings,
  tag = "togtmol-timer-warning",
) {
  await playTimerWarning(settings);
  showBrowserNotification(message, settings, tag, "Тогтмол · Сануулга");
}
