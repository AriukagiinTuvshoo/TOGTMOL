import type { Settings } from "@/types/study";
import { completionVolume } from "./preferences";

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;
let titleFlashTimer: number | null = null;

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
  tone.start(start);
  tone.stop(start + duration);
  tone.onended = () => {
    tone.disconnect();
    gain.disconnect();
  };
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
    const volume = Math.max(0.02, completionVolume(settings) * 0.72);
    // Three-part attention chime: unmistakable, but brief enough not to be annoying.
    scheduleTone(1047, now, 0.24, volume, "square");
    scheduleTone(1319, now + 0.28, 0.24, volume, "square");
    scheduleTone(1568, now + 0.56, 0.34, volume, "triangle");
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
    const volume = Math.max(0.03, completionVolume(settings) * 0.9);
    const pattern: Array<[number, number, number, OscillatorType]> = [
      [988, 0.0, 0.24, "square"],
      [1319, 0.26, 0.24, "square"],
      [1568, 0.52, 0.32, "triangle"],
      [1319, 0.88, 0.24, "square"],
      [988, 1.14, 0.55, "sawtooth"],
      [784, 2.0, 0.24, "square"],
      [1047, 2.26, 0.24, "square"],
      [1319, 2.52, 0.42, "triangle"],
    ];
    for (const [frequency, offset, duration, type] of pattern)
      scheduleTone(frequency, now + offset, duration, volume, type);
    safeVibrate([350, 120, 350, 120, 500, 160, 500]);
    flashTitle("⏰ Хугацаа дууслаа!");
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
