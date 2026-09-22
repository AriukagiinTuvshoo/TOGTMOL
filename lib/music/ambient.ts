import type { MusicProvider } from "./provider";
import type { AmbientId } from "./catalog";
// Original procedural soundscapes. No downloaded recordings or third-party tracks.
export class AmbientPlayer {
  private context: AudioContext;
  private gain: GainNode;
  private source: AudioBufferSourceNode | null = null;
  private current: string | null = null;
  private command = 0;
  private wanted = false;
  constructor() {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.25;
    this.gain.connect(this.context.destination);
  }
  volume(value: number) {
    this.gain.gain.setTargetAtTime(
      Math.min(1, Math.max(0, value)) * 0.5,
      this.context.currentTime,
      0.1,
    );
  }
  async play(id: AmbientId) {
    const command = ++this.command;
    this.wanted = true;
    await this.context.resume();
    if (command !== this.command) {
      if (!this.wanted && this.context.state !== "closed")
        await this.context.suspend();
      return;
    }
    if (this.context.state !== "running")
      throw Error("Дууг эхлүүлэхийн тулд Play-г дахин дараарай.");
    if (this.current === id && this.source) return;
    this.source?.stop();
    this.source?.disconnect();
    const rate = this.context.sampleRate,
      seconds = 16,
      buffer = this.context.createBuffer(1, rate * seconds, rate),
      samples = buffer.getChannelData(0);
    let low = 0,
      slow = 0;
    const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
    for (let i = 0; i < samples.length; i++) {
      const t = i / rate,
        noise = Math.random() * 2 - 1;
      low = 0.985 * low + 0.015 * noise;
      slow = 0.999 * slow + 0.001 * noise;
      let v = 0;
      if (id === "white") v = noise * 0.12;
      if (id === "deep") v = low * 1.6 + slow * 2;
      if (id === "rain") v = low * 2.2 + noise * 0.045;
      if (id === "cafe")
        v =
          low * 0.8 +
          Math.sin(t * 2 * Math.PI * 180) * slow * 0.65 +
          Math.sin(t * 2 * Math.PI * 910) * Math.exp(-(t % 4) * 30) * 0.035;
      if (id === "nature") {
        const chirp = t % 4;
        v =
          low * 0.6 +
          Math.sin(2 * Math.PI * (1800 * chirp + 600 * chirp * chirp)) *
            Math.max(0, Math.sin(Math.PI * chirp * 3)) *
            Math.exp(-chirp * 4) *
            0.06;
      }
      if (id === "ambient")
        v =
          (Math.sin(2 * Math.PI * 130 * t) +
            Math.sin(2 * Math.PI * 195 * t) +
            Math.sin(2 * Math.PI * 260 * t)) *
          0.045 *
          (0.8 + 0.2 * Math.cos((t * Math.PI) / 8));
      if (id === "night")
        v =
          (Math.sin(2 * Math.PI * 110 * t) +
            0.6 * Math.sin(2 * Math.PI * 165 * t)) *
            0.06 *
            (0.75 + 0.25 * Math.cos((t * Math.PI) / 8)) +
          low * 0.25;
      if (id === "piano" || id === "lofi") {
        const n = notes[Math.floor(t / 2) % notes.length],
          age = t % 2;
        v =
          (Math.sin(2 * Math.PI * n * age) +
            0.25 * Math.sin(2 * Math.PI * n * 2 * age) +
            0.08 * Math.sin(2 * Math.PI * n * 3 * age)) *
          Math.min(1, age * 90) *
          Math.exp(-age * 2) *
          0.16;
        if (id === "lofi") {
          const beat = t % 0.5;
          v +=
            Math.sin(
              2 * Math.PI * (48 * beat + 2 * (1 - Math.exp(-beat * 30))),
            ) *
              Math.exp(-beat * 22) *
              0.13 +
            noise * Math.exp(-(((t % 1) - 0.5) ** 2) * 5000) * 0.025 +
            low * 0.15;
        }
      }
      // Crossfade to silence at loop boundaries to avoid clicks.
      const fade = Math.min(1, t / 0.025, (seconds - t) / 0.025);
      samples[i] = Math.max(-0.8, Math.min(0.8, v)) * fade;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gain);
    source.start();
    this.source = source;
    this.current = id;
  }
  async pause() {
    this.command++;
    this.wanted = false;
    await this.context.suspend();
  }
  async stop() {
    this.command++;
    this.wanted = false;
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
    this.current = null;
    await this.context.suspend();
  }
  close() {
    this.command++;
    this.wanted = false;
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
    this.current = null;
    void this.context.close().catch(() => {});
  }
}

export function ambientProvider(
  player: AmbientPlayer,
  id: AmbientId,
): MusicProvider {
  return {
    kind: "ambient",
    requiresVisiblePlayer: false,
    play: () => player.play(id),
    pause: () => player.pause(),
    stop: () => player.stop(),
    setVolume: (value, muted) => player.volume(muted ? 0 : value),
  };
}
