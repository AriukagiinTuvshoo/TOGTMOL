import type { Settings } from "@/types/study";
import { completionVolume } from "./preferences";

let audioContext: AudioContext | null = null;

export async function enableSound() {
  if (typeof AudioContext === "undefined")
    throw Error("Энэ браузер дууны дохио дэмжихгүй.");
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
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
  gain.gain.linearRampToValueAtTime(volume, start + 0.025);
  gain.gain.setValueAtTime(volume, start + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  tone.start(start);
  tone.stop(start + duration);
  tone.onended = () => {
    tone.disconnect();
    gain.disconnect();
  };
}

export function playTimerWarning(settings: Settings) {
  if (!settings.sound || completionVolume(settings) <= 0) return;
  try {
    if (!audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    const volume = Math.max(0.0001, completionVolume(settings) * 0.16);
    scheduleTone(880, now, 0.16, volume);
    scheduleTone(880, now + 0.24, 0.16, volume);
  } catch {
    /* Audio is optional; a released device must not stop the timer. */
  }
}

export function notifyUser(
  message: string,
  settings: Settings,
  tag = "togtmol-reminder",
) {
  if (
    settings.sound &&
    completionVolume(settings) > 0 &&
    audioContext?.state === "running"
  )
    try {
      const now = audioContext.currentTime;
      const volume = Math.max(0.0001, completionVolume(settings) * 0.22);
      const tones = [
        [880, 0.0, 0.28],
        [660, 0.32, 0.28],
        [880, 0.64, 0.28],
        [660, 0.96, 0.28],
      ] as const;
      for (const [frequency, offset, duration] of tones)
        scheduleTone(frequency, now + offset, duration, volume);
    } catch {
      /* Audio is optional; a released device must not stop timer completion. */
    }

  if (
    settings.notifications &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .getRegistration()
        .then(async (reg) => {
          if (reg?.active)
            await reg.showNotification("Тогтмол · Бондоок", {
              body: message,
              icon: "/icons/icon-192.png",
              tag,
            });
          else new Notification("Тогтмол · Бондоок", { body: message, tag });
        })
        .catch(() => {});
    else
      try {
        new Notification("Тогтмол", { body: message });
      } catch {}
  }
}
