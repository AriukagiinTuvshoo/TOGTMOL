// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  render,
  renderHook,
  waitFor,
  cleanup,
  act,
  screen,
  fireEvent,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { YouTubeEmbed } from "@/components/music/youtube-embed";
import { ModuleBoundary } from "@/components/ui/module-boundary";
const youtube = vi.hoisted(() => ({ mount: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/music/youtube-player", () => ({
  loadYouTube: youtube.load,
  mountYouTube: youtube.mount,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("media failure isolation", () => {
  it("clears a detached YouTube player during repeated app unmount and ignores late callbacks", async () => {
    youtube.load.mockResolvedValue({});
    const destroyed = vi.fn(() => {
      throw Error("detached iframe");
    });
    const paused = vi.fn(() => {
      throw Error("detached iframe");
    });
    const callbacks: {
      ready: (player: unknown) => void;
      state: (s: number) => void;
      error: (s: string) => void;
    }[] = [];
    youtube.mount.mockImplementation((_api, _element, _source, events) => {
      callbacks.push(events);
      const p = { destroy: destroyed, pauseVideo: paused };
      queueMicrotask(() => events.ready(p));
      return p;
    });
    const ready = vi.fn(),
      state = vi.fn(),
      error = vi.fn();
    for (let i = 0; i < 12; i++) {
      const ui = render(
        <YouTubeEmbed
          source={{ kind: "video", youtubeId: "abcdefghijk" }}
          onReady={ready}
          onState={state}
          onError={error}
        />,
      );
      await waitFor(() =>
        expect(ready.mock.calls.at(-1)?.[0]).toMatchObject({
          destroy: destroyed,
        }),
      );
      expect(() => ui.unmount()).not.toThrow();
      expect(ready.mock.calls.at(-1)?.[0]).toBeNull();
    }
    callbacks.forEach((cb) => {
      cb.state(1);
      cb.error("late failure");
    });
    expect(state).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(destroyed).toHaveBeenCalledTimes(12);
  });
  it("keeps other modules mounted when one render fails and supports a targeted retry", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    function Unstable() {
      if (broken) throw Error("failed module");
      return <p>Recovered module</p>;
    }
    render(
      <>
        <p>Timer remains mounted</p>
        <ModuleBoundary name="Хөгжим">
          <Unstable />
        </ModuleBoundary>
      </>,
    );
    expect(screen.getByText("Timer remains mounted")).toBeVisible();
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: /Дахин/ }));
    expect(screen.getByText("Recovered module")).toBeVisible();
    log.mockRestore();
  });
  it("requests a screen wake lock only when enabled, reacquires after visibility returns and releases on exit", async () => {
    const locks: (EventTarget & {
      released: boolean;
      release: () => Promise<void>;
    })[] = [];
    const request = vi.fn(async () => {
      const lock = Object.assign(new EventTarget(), {
        released: false,
        release: vi.fn(async () => {
          lock.released = true;
          lock.dispatchEvent(new Event("release"));
        }),
      });
      locks.push(lock);
      return lock;
    });
    vi.stubGlobal("navigator", { wakeLock: { request } });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    const hook = renderHook(({ enabled }) => useWakeLock(enabled), {
      initialProps: { enabled: false },
    });
    expect(request).not.toHaveBeenCalled();
    hook.rerender({ enabled: true });
    await waitFor(() =>
      expect(hook.result.current).toBe("Дэлгэц сэрүүн байна"),
    );
    await act(async () => {
      visibility.mockReturnValue("hidden");
      await locks[0].release();
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(request).toHaveBeenCalledTimes(2);
    hook.unmount();
    expect(locks[1].release).toHaveBeenCalled();
  });
});
