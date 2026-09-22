import type { Settings } from "@/types/study";
import { completionVolume } from "./preferences";
let audioContext: AudioContext | null = null;
export async function enableSound() {
  if (typeof AudioContext === "undefined")
    throw Error("Энэ браузер дууны дохио дэмжихгүй.");
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
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
      const oscillator = audioContext.createOscillator(),
        gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(
        Math.max(0.0001, completionVolume(settings) * 0.16),
        audioContext.currentTime,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.4,
      );
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.4);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
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
