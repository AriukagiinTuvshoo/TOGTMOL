// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { AppShell } from "@/components/app-shell";
import { MusicProvider } from "@/components/music/music-provider";
import { StudyProvider } from "@/hooks/use-study";
import { Repository } from "@/lib/persistence/repository";
import {
  normalizeMusicPreference,
  type MusicPreferences,
} from "@/lib/music/preferences";
import { fixture } from "./fixtures";
const local = vi.hoisted(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  close: vi.fn(),
  volume: vi.fn(),
}));
vi.mock("@/lib/music/ambient", () => ({
  AmbientPlayer: class {
    close = local.close;
  },
  ambientProvider: (_engine: unknown, id: string) => ({
    kind: "ambient",
    requiresVisiblePlayer: false,
    play: async () => {
      local.play(id);
    },
    pause: async () => {
      local.pause();
    },
    stop: async () => {
      local.stop();
    },
    setVolume: local.volume,
  }),
}));
type Events = {
  onReady: (event: { target: Player }) => void;
  onStateChange: (event: { target: Player; data: number }) => void;
  onError: (event: { target: Player; data: number }) => void;
};
let players: Player[] = [],
  failConstruction = false;
class Player {
  iframe: HTMLIFrameElement;
  events: Events;
  state = 5;
  position = 0;
  index = 0;
  videoId = "abcdefghijk";
  metadata = { title: "Loaded music track", author: "Test artist" };
  constructor(
    element: HTMLElement,
    readonly options: Record<string, unknown>,
  ) {
    if (failConstruction) throw Error("YouTube initialization failure");
    this.events = options.events as Events;
    this.iframe = document.createElement("iframe");
    this.iframe.title = "Test YouTube";
    element.replaceWith(this.iframe);
    players.push(this);
    queueMicrotask(() => this.events.onReady({ target: this }));
  }
  emit = (data: number) => {
    this.state = data;
    this.events.onStateChange({ target: this, data });
  };
  playVideo = vi.fn(() => this.emit(1));
  pauseVideo = vi.fn(() => this.emit(2));
  stopVideo = vi.fn(() => {
    this.position = 0;
    this.emit(-1);
  });
  nextVideo = vi.fn(() => {
    this.index++;
    this.emit(1);
  });
  previousVideo = vi.fn(() => {
    this.index = Math.max(0, this.index - 1);
    this.emit(1);
  });
  destroy = vi.fn(() => this.iframe.remove());
  setVolume = vi.fn();
  mute = vi.fn();
  unMute = vi.fn();
  getPlayerState = () => this.state;
  getCurrentTime = () => this.position;
  getPlaylistIndex = () => this.index;
  getVideoUrl = () => `https://www.youtube.com/watch?v=${this.videoId}`;
  getVideoData = () => ({ ...this.metadata, video_id: this.videoId });
  seekTo = vi.fn((seconds: number) => {
    this.position = seconds;
  });
  cuePlaylist = vi.fn();
}
beforeEach(() => {
  players = [];
  failConstruction = false;
  for (const fn of Object.values(local)) fn.mockReset();
  localStorage.clear();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  window.YT = { Player };
  document
    .querySelectorAll("script[data-togtmol-youtube]")
    .forEach((s) => s.remove());
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  window.scrollTo = vi.fn();
  window.confirm = vi.fn().mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  delete window.YT;
  Reflect.deleteProperty(navigator, "mediaSession");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function boot(kind: "video" | "playlist" = "video") {
  const data = fixture();
  data.settings.sound = false;
  data.musicSources = [
    {
      id: "youtube-test",
      kind,
      youtubeId: kind === "video" ? "abcdefghijk" : "PLabcdefghijk123",
      title: "My study music",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      extras: {},
    },
  ];
  data.settings.extras.musicPreferences = normalizeMusicPreference({
    lastPlayed: "youtube-test",
  });
  const repo = new Repository();
  await repo.save("guest", data, 0);
  await repo.close();
  const ui = render(<AppShell />);
  await screen.findByText("Миний төлөвлөгөө");
  return ui;
}
const dock = () => screen.getByRole("complementary", { name: "Study music" });
const click = (name: string) =>
  fireEvent.click(within(dock()).getByRole("button", { name }));
async function load() {
  click("Хөгжим нээх");
  await screen.findByTitle("Test YouTube");
  await waitFor(() => expect(players.length).toBeGreaterThan(0));
  return players.at(-1)!;
}
async function start() {
  click("Хөгжим тоглуулах");
  await waitFor(() =>
    expect(dock()).toHaveAttribute("data-playback", "playing"),
  );
}
function navigate(name: string) {
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Үндсэн цэс" })).getByRole(
      "button",
      { name },
    ),
  );
}
async function savedPreference() {
  const repo = new Repository();
  const saved = await repo.load("guest");
  await repo.close();
  return saved?.data.settings.extras.musicPreferences as MusicPreferences;
}
describe("persistent music dock", () => {
  it("minimizes and expands repeatedly without stopping or recreating the same iframe", async () => {
    await boot();
    const player = await load();
    await start();
    const iframe = screen.getByTitle("Test YouTube");
    for (let i = 0; i < 5; i++) {
      click("Хөгжим багасгах");
      expect(dock()).toHaveAttribute("data-open", "false");
      expect(screen.getByTitle("Test YouTube")).toBe(iframe);
      expect(screen.getByTitle("Test YouTube")).toBeVisible();
      expect(
        within(dock()).getByRole("slider", { name: "Дууны түвшин" }),
      ).toBeVisible();
      click("Хөгжим нээх");
    }
    expect(players).toHaveLength(1);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(player.pauseVideo).not.toHaveBeenCalled();
    expect(player.stopVideo).not.toHaveBeenCalled();
    expect(player.destroy).not.toHaveBeenCalled();
  });
  it("keeps playback through Overview → Calendar → Subjects → Statistics → Room → AI → Overview", async () => {
    await boot();
    const player = await load();
    await start();
    click("Хөгжим багасгах");
    for (const page of [
      "Миний өрөө",
      "Календарь",
      "Хичээлүүд",
      "Статистик",
      "Өрөөний загвар",
      "Суралцах туслах",
      "Миний өрөө",
    ]) {
      navigate(page);
      await waitFor(() =>
        expect(
          within(
            screen.getByRole("navigation", { name: "Үндсэн цэс" }),
          ).getByRole("button", { name: page }),
        ).toHaveAttribute("aria-current", "page"),
      );
      expect(screen.getByTitle("Test YouTube")).toBe(player.iframe);
      expect(dock()).toHaveAttribute("data-playback", "playing");
    }
    expect(players).toHaveLength(1);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(player.pauseVideo).not.toHaveBeenCalled();
    expect(player.stopVideo).not.toHaveBeenCalled();
    expect(player.destroy).not.toHaveBeenCalled();
  });
  it("distinguishes explicit Stop from Pause and keeps the iframe available for replay", async () => {
    await boot();
    const player = await load();
    await start();
    player.position = 53;
    click("Хөгжим түр зогсоох");
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    expect(player.stopVideo).not.toHaveBeenCalled();
    await start();
    expect(player.position).toBe(53);
    click("Хөгжим зогсоох");
    expect(player.stopVideo).toHaveBeenCalledTimes(1);
    expect(dock()).toHaveAttribute("data-playback", "stopped");
    expect(screen.getByTitle("Test YouTube")).toBe(player.iframe);
    expect(player.destroy).not.toHaveBeenCalled();
    await waitFor(async () =>
      expect((await savedPreference()).session).toMatchObject({
        playback: "stopped",
        position: 0,
      }),
    );
    await start();
    expect(player.seekTo).toHaveBeenLastCalledWith(0, true);
  });
  it("persists playlist/video metadata, position, volume and minimized state without autoplay on reload", async () => {
    const ui = await boot("playlist");
    const player = await load();
    await start();
    player.position = 87;
    player.index = 2;
    player.videoId = "abcdefghijZ";
    fireEvent.change(
      within(dock()).getByRole("slider", { name: "Дууны түвшин" }),
      { target: { value: "0.65" } },
    );
    click("Хөгжим багасгах");
    await waitFor(async () =>
      expect(await savedPreference()).toMatchObject({
        volume: 0.65,
        session: {
          selection: "youtube-test",
          open: false,
          playback: "playing",
          position: 87,
          playlistIndex: 2,
          track: {
            title: "Loaded music track",
            artist: "Test artist",
            videoId: "abcdefghijZ",
            url: "https://www.youtube.com/watch?v=abcdefghijZ",
          },
        },
      }),
    );
    ui.unmount();
    render(<AppShell />);
    await screen.findByTitle("Test YouTube");
    await waitFor(() => expect(players).toHaveLength(2));
    const restored = players[1];
    expect(restored.playVideo).not.toHaveBeenCalled();
    expect(restored.cuePlaylist).toHaveBeenCalledWith({
      list: "PLabcdefghijk123",
      listType: "playlist",
      index: 2,
      startSeconds: 87,
    });
    expect(restored.setVolume).toHaveBeenCalledWith(65);
    expect(dock()).toHaveAttribute("data-open", "false");
    expect(dock()).toHaveAttribute("data-playback", "paused");
    expect(screen.getByText("Үргэлжлүүлэхэд Play дарна уу")).toBeVisible();
  });
  it("does not pause on visibility/intersection changes or a mobile-size resize", async () => {
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = observe;
        disconnect() {}
      },
    );
    await boot();
    const player = await load();
    await start();
    click("Хөгжим багасгах");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    vi.stubGlobal("innerWidth", 375);
    fireEvent(window, new Event("resize"));
    expect(observe).not.toHaveBeenCalled();
    for (const name of ["Хөгжим түр зогсоох", "Хөгжим зогсоох", "Хөгжим нээх"])
      expect(within(dock()).getByRole("button", { name })).toBeVisible();
    expect(
      within(dock()).getByRole("slider", { name: "Дууны түвшин" }),
    ).toBeVisible();
    click("Хөгжим нээх");
    expect(dock()).toHaveAttribute("data-open", "true");
    click("Хөгжим багасгах");
    expect(player.pauseVideo).not.toHaveBeenCalled();
    expect(player.destroy).not.toHaveBeenCalled();
    expect(player.playVideo).toHaveBeenCalledTimes(1);
  });
  it("isolates construction, iframe and command errors and recovers only the music player", async () => {
    failConstruction = true;
    await boot();
    click("Хөгжим нээх");
    expect(await screen.findByText(/YouTube-г ачаалж чадсангүй/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    navigate("Хичээлүүд");
    expect(
      screen.getByRole("heading", { name: "Миний хичээлүүд" }),
    ).toBeVisible();
    failConstruction = false;
    click("Дахин ачаалах");
    await screen.findByTitle("Test YouTube");
    const player = players[0];
    await start();
    act(() => player.events.onError({ target: player, data: 100 }));
    expect(
      screen.getByText(/Энэ бичлэгийг энд тоглуулах боломжгүй/),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await start();
    player.pauseVideo.mockImplementationOnce(() => {
      throw Error("detached");
    });
    click("Хөгжим түр зогсоох");
    expect(
      await screen.findByText(/Хөгжмийн удирдлага тасарлаа/),
    ).toBeVisible();
    navigate("Календарь");
    expect(
      screen.getByRole("heading", { name: "Суралцах календарь" }),
    ).toBeVisible();
  });
  it("keeps a music storage failure local and continues playing", async () => {
    await boot();
    const player = await load();
    await start();
    await waitFor(async () =>
      expect((await savedPreference()).session?.playback).toBe("playing"),
    );
    const save = vi
      .spyOn(Repository.prototype, "save")
      .mockRejectedValueOnce(Error("quota"));
    fireEvent.change(
      within(dock()).getByRole("slider", { name: "Дууны түвшин" }),
      { target: { value: "0.8" } },
    );
    expect(
      await screen.findByText(/Хөгжмийн тохиргоог хадгалж чадсангүй/),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(player.pauseVideo).not.toHaveBeenCalled();
    expect(dock()).toHaveAttribute("data-playback", "playing");
    save.mockRestore();
  });
  it("keeps music settings usable with blocked localStorage and working IndexedDB", async () => {
    await boot();
    const player = await load();
    await start();
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    fireEvent.change(
      within(dock()).getByRole("slider", { name: "Дууны түвшин" }),
      { target: { value: "0.55" } },
    );
    await waitFor(async () =>
      expect((await savedPreference()).volume).toBe(0.55),
    );
    expect(player.setVolume).toHaveBeenCalledWith(55);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(dock()).toHaveAttribute("data-playback", "playing");
  });
  it("handles a failed API script and allows a local retry without touching study views", async () => {
    delete window.YT;
    await boot();
    click("Хөгжим нээх");
    let script: HTMLScriptElement | null = null;
    await waitFor(() => {
      script = document.querySelector("script[data-togtmol-youtube]");
      expect(script).not.toBeNull();
    });
    fireEvent.error(script!);
    expect(await screen.findByText(/YouTube-г ачаалж чадсангүй/)).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    window.YT = { Player };
    click("Дахин ачаалах");
    await screen.findByTitle("Test YouTube");
    await start();
    expect(players).toHaveLength(1);
  });
  it("starts, pauses, resumes and finishes study without controlling the music state machine", async () => {
    let now = new Date("2026-09-22T12:00:00Z").getTime();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await boot();
    const player = await load();
    await start();
    click("Хөгжим багасгах");
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Гар утасны цэс" }),
      ).getByRole("button", { name: "Төвлөрөх" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start study" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start study" }));
    await waitFor(() => {
      const alert = screen.queryByRole("alert");
      if (alert) throw Error(alert.textContent ?? "Study error");
      expect(screen.queryByRole("button", { name: "Pause" })).not.toBeNull();
    });
    now += 10000;
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await screen.findByRole("button", { name: "Resume" });
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await screen.findByRole("button", { name: "Pause" });
    now += 10000;
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Үр дүнгээ хадгалах" }),
    );
    await screen.findByText(/Хичээлээ хадгаллаа/);
    expect(dock()).toHaveAttribute("data-playback", "playing");
    expect(screen.getByTitle("Test YouTube")).toBe(player.iframe);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(player.pauseVideo).not.toHaveBeenCalled();
    expect(player.stopVideo).not.toHaveBeenCalled();
    expect(player.destroy).not.toHaveBeenCalled();
  });
  it("uses Media Session play, pause, next and previous handlers and cleans them up on app exit", async () => {
    const handlers = new Map<string, (() => void) | null>();
    const setActionHandler = vi.fn(
      (name: string, action: (() => void) | null) => handlers.set(name, action),
    );
    const media = { setActionHandler, playbackState: "none", metadata: null };
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: media,
    });
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(value: object) {
          Object.assign(this, value);
        }
      },
    );
    const ui = await boot("playlist");
    const player = await load();
    await act(async () => {
      handlers.get("play")?.();
    });
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(media.playbackState).toBe("playing");
    expect(media.metadata).toMatchObject({
      title: "Loaded music track",
      artist: "Test artist",
    });
    act(() => {
      handlers.get("pause")?.();
    });
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    act(() => {
      handlers.get("nexttrack")?.();
      handlers.get("previoustrack")?.();
    });
    expect(player.nextVideo).toHaveBeenCalledTimes(1);
    expect(player.previousVideo).toHaveBeenCalledTimes(1);
    navigate("Календарь");
    expect(setActionHandler).toHaveBeenCalledTimes(5);
    ui.unmount();
    expect([...handlers.values()].every((v) => v === null)).toBe(true);
    expect(media.playbackState).toBe("none");
  });
  it("keeps generated/local audio working through minimize, navigation, pause and explicit Stop", async () => {
    await boot();
    click("Хөгжим нээх");
    fireEvent.click(
      within(dock()).getByRole("button", { name: /Rainy window.*Борооны/ }),
    );
    await start();
    expect(local.play).toHaveBeenLastCalledWith("rain");
    click("Хөгжим багасгах");
    navigate("Календарь");
    expect(local.pause).not.toHaveBeenCalled();
    expect(local.close).not.toHaveBeenCalled();
    click("Хөгжим түр зогсоох");
    await waitFor(() => expect(local.pause).toHaveBeenCalledTimes(1));
    await start();
    click("Хөгжим зогсоох");
    await waitFor(() => expect(local.stop).toHaveBeenCalledTimes(1));
  });
  it("contains a music render failure within the floating fallback", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function BrokenMusic(): React.ReactNode {
      throw Error("render failure");
    }
    render(
      <StudyProvider>
        <p>Study remains available</p>
        <MusicProvider>
          <BrokenMusic />
        </MusicProvider>
      </StudyProvider>,
    );
    expect(screen.getByText("Study remains available")).toBeVisible();
    expect(within(dock()).getByRole("alert")).toHaveTextContent(
      "Хөгжим түр ажиллахгүй",
    );
    expect(
      screen.getByRole("button", { name: "Хөгжмийг дахин нээх" }),
    ).toBeVisible();
    await act(async () => {});
  });
});
