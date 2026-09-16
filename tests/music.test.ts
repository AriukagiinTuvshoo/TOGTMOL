import { afterEach, describe, expect, it, vi } from "vitest";
import { AmbientPlayer, ambientProvider } from "@/lib/music/ambient";
import { AMBIENTS } from "@/lib/music/catalog";
afterEach(() => vi.unstubAllGlobals());
describe("original soundscape playback", () => {
  it("generates finite bounded samples for every preset, pauses/resumes and cleans up", async () => {
    const buffers: Float32Array[] = [],
      started = vi.fn(),
      stopped = vi.fn(),
      suspend = vi.fn(),
      close = vi.fn();
    class Context {
      sampleRate = 8000;
      currentTime = 0;
      state = "suspended";
      destination = {};
      createGain() {
        return {
          gain: { value: 0, setTargetAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      async resume() {
        this.state = "running";
      }
      async suspend() {
        this.state = "suspended";
        suspend();
      }
      async close() {
        close();
      }
      createBuffer(channels: number, length: number) {
        const buffer = new Float32Array(length);
        buffers.push(buffer);
        return { getChannelData: () => buffer };
      }
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: started,
          stop: stopped,
        };
      }
    }
    vi.stubGlobal("AudioContext", Context);
    const engine = new AmbientPlayer();
    expect(started).not.toHaveBeenCalled();
    for (const preset of AMBIENTS)
      await ambientProvider(engine, preset.id).play();
    expect(started).toHaveBeenCalledTimes(7);
    expect(buffers).toHaveLength(7);
    for (const samples of buffers) {
      expect(
        samples.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.8),
      ).toBe(true);
      expect(samples.some((v) => Math.abs(v) > 0.001)).toBe(true);
    }
    const provider = ambientProvider(engine, "night");
    await provider.pause();
    expect(suspend).toHaveBeenCalled();
    await provider.play();
    expect(started).toHaveBeenCalledTimes(7);
    engine.close();
    expect(close).toHaveBeenCalled();
    expect(stopped).toHaveBeenCalledTimes(7);
  });
});
