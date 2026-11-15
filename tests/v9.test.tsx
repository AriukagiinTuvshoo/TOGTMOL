// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { ROOMS, resolveV9RoomId, roomById } from "@/lib/v9/rooms";
import {
  fmtClock,
  fmtMnDuration,
  focusScore,
  levelForXp,
  xpForSession,
} from "@/lib/v9/focus";
import { CHANNELS, PRESETS, engine } from "@/lib/v9/audio-engine";
import { defaultWorld } from "@/lib/world/config";

describe("TOGTMOL v9 Deep Focus Room", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    localStorage.clear();
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("BroadcastChannel", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.scrollTo = vi.fn();
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
    engine.stopAll();
  });

  afterEach(() => {
    engine.stopAll();
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("defines 10 immersive rooms and defaults fresh cozy world visually to Шөнийн өрөө", () => {
    expect(ROOMS).toHaveLength(10);
    const fresh = defaultWorld();
    expect(fresh.design).toBe("cozy");
    expect(resolveV9RoomId(fresh)).toBe("night");
    expect(roomById(resolveV9RoomId(fresh)).nameMn).toBe("Шөнийн өрөө");

    expect(resolveV9RoomId({ ...fresh, extras: { v9Room: "cozy" } })).toBe(
      "cozy",
    );
    expect(resolveV9RoomId({ ...fresh, design: "sakura" })).toBe("sakura");
  });

  it("computes focus score, XP, levels, and Mongolian durations accurately", () => {
    const score = focusScore({
      plannedSeconds: 1500,
      actualSeconds: 1500,
      completed: true,
      interruptions: 0,
      mode: "pomodoro",
      hourOfDay: 22,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(xpForSession(1500, score, true)).toBeGreaterThan(50);

    const lvl = levelForXp(320);
    expect(lvl.level).toBeGreaterThanOrEqual(2);
    expect(fmtClock(1500)).toBe("25:00");
    expect(fmtMnDuration(0)).toBe("0 сек");
    expect(fmtMnDuration(1500)).toBe("25 мин");
  });

  it("manages 13 audio channels and 11 presets reactively without requiring AudioContext on mount", () => {
    expect(CHANNELS).toHaveLength(13);
    expect(PRESETS).toHaveLength(11);

    engine.applyPreset("rainy-cafe");
    const snap = engine.getSnapshot();
    expect(snap.activePreset).toBe("rainy-cafe");
    expect(snap.activeCount).toBeGreaterThan(0);

    engine.stopAll();
    expect(engine.getSnapshot().activeCount).toBe(0);
    expect(engine.getSnapshot().activePreset).toBeNull();
  });

  it("renders the v9 3-column bento room, opens the fullscreen focus dial, expands the 13-channel mixer, and switches rooms", async () => {
    render(<AppShell />);

    await screen.findByText("Цагийн систем");
    expect(screen.getByText("Дууны систем")).toBeInTheDocument();
    expect(screen.getByText("Амьсгалын дасгал")).toBeInTheDocument();
    expect(screen.getByText("Фокус зөвлөгөө")).toBeInTheDocument();

    // Expand 13-channel mixer
    fireEvent.click(
      screen.getByRole("button", { name: /Микшер нээх — 13 суваг/i }),
    );
    expect(screen.getByText("Шилэн дээрх бороо")).toBeInTheDocument();
    expect(screen.getByText("Альфа долгион 10Hz")).toBeInTheDocument();

    // Open Fullscreen Focus Overlay (image-2.png)
    fireEvent.click(
      screen.getByRole("button", { name: /Дарж бүтэн дэлгэцээр томруулах/i }),
    );
    expect(await screen.findByText("Өдрийн зорилго")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Богино амралт" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Урт амралт" }),
    ).toBeInTheDocument();

    // Close Fullscreen Focus Overlay
    fireEvent.click(screen.getByRole("button", { name: "Том цаг хаах" }));

    // Switch room from 10-room picker modal
    fireEvent.click(screen.getByRole("button", { name: /Шөнийн өрөө/i }));
    expect(
      await screen.findByText("10 өрөө — орчноо сонго"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Бороо \+ кофе \+ ном/i }),
    );

    expect(
      await screen.findByText(/Борооны чимээ нь ярианы чимээг далдалж/i),
    ).toBeInTheDocument();
  });
});
