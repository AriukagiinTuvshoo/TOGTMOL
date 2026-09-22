// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useClock } from "@/hooks/use-study";

function ClockProbe() {
  const now = useClock(true);
  return <output aria-label="clock-value">{now}</output>;
}

describe("useClock", () => {
  let visible = true;
  let nextFrame = 1;
  let callbacks = new Map<number, FrameRequestCallback>();

  beforeEach(() => {
    visible = true;
    nextFrame = 1;
    callbacks = new Map();

    vi.spyOn(document, "visibilityState", "get").mockImplementation(() =>
      visible ? "visible" : "hidden",
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = nextFrame++;
      callbacks.set(id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      callbacks.delete(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("schedules a fresh RAF after a hidden callback stops the visible loop", () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);

    render(<ClockProbe />);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    const firstId = [...callbacks.keys()][0];
    const firstCallback = callbacks.get(firstId);
    expect(firstCallback).toBeDefined();

    visible = false;
    act(() => {
      firstCallback?.(0);
    });
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    now = 2_000;
    visible = true;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByLabelText("clock-value")).toHaveTextContent("2000");
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});
