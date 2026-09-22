import { afterEach, describe, expect, it, vi } from "vitest";
import { AmbientPlayer, ambientProvider } from "@/lib/music/ambient";
import { AMBIENTS } from "@/lib/music/catalog";
import { normalizeMusicPreference } from "@/lib/music/preferences";
import { parseAudioURL } from "@/lib/music/native-audio";
import { StudyStore } from "@/lib/persistence/store";
import { Repository } from "@/lib/persistence/repository";
import { IDBFactory } from "fake-indexeddb";
import { MemoryStorage, fixture } from "./fixtures";
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
    expect(started).toHaveBeenCalledTimes(AMBIENTS.length);
    expect(buffers).toHaveLength(AMBIENTS.length);
    for (const samples of buffers) {
      expect(
        samples.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.8),
      ).toBe(true);
      expect(samples.some((v) => Math.abs(v) > 0.001)).toBe(true);
    }
    const provider = ambientProvider(engine, "rain");
    await provider.pause();
    expect(suspend).toHaveBeenCalled();
    await provider.play();
    expect(started).toHaveBeenCalledTimes(AMBIENTS.length + 1);
    engine.close();
    expect(close).toHaveBeenCalled();
    expect(stopped).toHaveBeenCalledTimes(AMBIENTS.length + 1);
  });
});

describe("music persistence and cancellation", () => {
  it("normalizes old preferences and rejects malformed playback metadata", () => {
    expect(normalizeMusicPreference({ volume: 0.7 }).session).toBeNull();
    const value = normalizeMusicPreference({
      volume: Infinity,
      session: {
        selection: "youtube-test",
        open: true,
        playback: "playing",
        position: -40,
        playlistIndex: 1.5,
        track: {
          title: "My song",
          artist: "Artist",
          url: "javascript:alert(1)",
          videoId: "<iframe>",
        },
      },
    });
    expect(value).toMatchObject({
      volume: 0.4,
      session: {
        selection: "youtube-test",
        open: true,
        playback: "playing",
        position: 0,
        playlistIndex: 0,
        track: { title: "My song", artist: "Artist", url: "", videoId: null },
      },
    });
  });
  it("does not disable study controls, erase study errors or mutate study records during music writes", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const repo = new Repository(new IDBFactory(), new MemoryStorage());
    await repo.save("guest", fixture(), 0);
    const store = new StudyStore(repo);
    await store.initialize();
    const before = store.getSnapshot().data;
    store.reportError(Error("Existing study warning"));
    const busy: boolean[] = [];
    const unsubscribe = store.subscribe(() =>
      busy.push(store.getSnapshot().busy),
    );
    const musicWrite = () =>
      store.mutate(
        (d) => ({
          ...d,
          settings: {
            ...d.settings,
            extras: {
              ...d.settings.extras,
              musicPreferences: normalizeMusicPreference({ volume: 0.6 }),
            },
          },
        }),
        { reportError: false, reportBusy: false },
      );
    await musicWrite();
    expect(busy.every((v) => v === false)).toBe(true);
    expect(store.getSnapshot().error).toBe("Existing study warning");
    const after = store.getSnapshot().data;
    expect({ ...after, settings: before.settings }).toEqual(before);
    const save = vi
      .spyOn(repo, "save")
      .mockRejectedValueOnce(Error("music quota"));
    await expect(musicWrite()).rejects.toThrow("music quota");
    expect(store.getSnapshot().error).toBe("Existing study warning");
    save.mockRestore();
    busy.length = 0;
    await store.mutate((d) => ({
      ...d,
      settings: { ...d.settings, sound: !d.settings.sound },
    }));
    expect(busy).toContain(true);
    expect(store.getSnapshot().busy).toBe(false);
    expect(store.getSnapshot().error).toBeNull();
    unsubscribe();
    store.destroy();
    await repo.close();
  });
  it("cancels a pending local resume when Stop arrives first", async () => {
    let finishResume = () => {};
    const suspended = vi.fn(),
      createBuffer = vi.fn();
    class Context {
      state = "suspended";
      currentTime = 0;
      destination = {};
      createGain() {
        return { gain: { value: 0, setTargetAtTime() {} }, connect() {} };
      }
      resume() {
        return new Promise<void>((resolve) => {
          finishResume = () => {
            this.state = "running";
            resolve();
          };
        });
      }
      async suspend() {
        this.state = "suspended";
        suspended();
      }
      async close() {
        this.state = "closed";
      }
      createBuffer = createBuffer;
    }
    vi.stubGlobal("AudioContext", Context);
    const engine = new AmbientPlayer();
    const playing = engine.play("rain");
    await engine.stop();
    finishResume();
    await playing;
    expect(createBuffer).not.toHaveBeenCalled();
    expect(suspended).toHaveBeenCalledTimes(2);
    engine.close();
  });
});

describe("native audio library", () => {
  it("validates remote audio URLs without allowing executable schemes", () => {
    expect(parseAudioURL("https://cdn.example.com/music/study.mp3")).toBe(
      "https://cdn.example.com/music/study.mp3",
    );
    expect(() => parseAudioURL("javascript:alert(1)")).toThrow();
    expect(() =>
      parseAudioURL("https://user:pass@example.com/song.mp3"),
    ).toThrow();
  });

  it("stores uploaded audio blobs separately from study JSON", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage());
    await repo.save("guest", fixture(), 0);
    await repo.initialize("guest");
    const blob = new Blob(["native-audio"], { type: "audio/mpeg" });
    await repo.saveMusicBlob("guest", "musicblob_test123", blob);
    const loaded = await repo.loadMusicBlob("guest", "musicblob_test123");
    expect(loaded).not.toBeNull();
    expect(await loaded!.text()).toBe("native-audio");
    await repo.deleteMusicBlob("guest", "musicblob_test123");
    expect(await repo.loadMusicBlob("guest", "musicblob_test123")).toBeNull();
    await repo.close();
  });

  it("can clear all uploaded audio for a namespace", async () => {
    const repo = new Repository(new IDBFactory(), new MemoryStorage());
    await repo.save("guest", fixture(), 0);
    await repo.initialize("guest");
    await repo.saveMusicBlob(
      "guest",
      "musicblob_test123",
      new Blob(["one"], { type: "audio/mpeg" }),
    );
    await repo.saveMusicBlob(
      "guest",
      "musicblob_test456",
      new Blob(["two"], { type: "audio/mpeg" }),
    );
    await repo.saveMusicBlob(
      "other",
      "musicblob_test789",
      new Blob(["keep"], { type: "audio/mpeg" }),
    );
    await repo.clearMusicBlobs("guest");
    expect(await repo.loadMusicBlob("guest", "musicblob_test123")).toBeNull();
    expect(await repo.loadMusicBlob("guest", "musicblob_test456")).toBeNull();
    expect(
      await repo.loadMusicBlob("other", "musicblob_test789"),
    ).not.toBeNull();
    await repo.close();
  });
});
