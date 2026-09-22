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
      // Богино нэг beep биш, сэрүүлэг шиг давтагдсан хоёр өнгийн дохио.
      // Browser зөвшөөрсөн үед timer дуусмагц анхаарал татахуйц сонсогдоно.
      const now = audioContext.currentTime;
      const volume = Math.max(0.0001, completionVolume(settings) * 0.22);
      const tones = [
        [880, 0.0, 0.28],
        [660, 0.32, 0.28],
        [880, 0.64, 0.28],
        [660, 0.96, 0.28],
      ] as const;

      for (const [frequency, offset, duration] of tones) {
        const tone = audioContext.createOscillator();
        const toneGain = audioContext.createGain();
        tone.type = "sine";
        tone.frequency.value = frequency;
        tone.connect(toneGain);
        toneGain.connect(audioContext.destination);
        toneGain.gain.setValueAtTime(0.0001, now + offset);
        toneGain.gain.linearRampToValueAtTime(volume, now + offset + 0.025);
        toneGain.gain.setValueAtTime(volume, now + offset + duration - 0.05);
        toneGain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + offset + duration,
        );
        tone.start(now + offset);
        tone.stop(now + offset + duration);
        tone.onended = () => {
          tone.disconnect();
          toneGain.disconnect();
        };
      }
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
