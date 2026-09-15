import type { Settings } from "@/types/study";
let audioContext: AudioContext | null = null;
export async function enableSound() {
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
}
export function notifyUser(message: string, settings: Settings) {
  if (settings.sound && audioContext?.state === "running") {
    const oscillator = audioContext.createOscillator(),
      gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.4,
    );
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.4);
  }
  if (
    settings.notifications &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.ready
        .then((reg) =>
          reg.showNotification("Тогтмол", {
            body: message,
            icon: "/icons/icon-192.png",
            tag: "togtmol-reminder",
          }),
        )
        .catch(() => {});
    else
      try {
        new Notification("Тогтмол", { body: message });
      } catch {}
  }
}
