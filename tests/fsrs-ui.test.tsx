// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { AppShell } from "@/components/app-shell";
import { openView } from "./nav-helper";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("review algorithm settings", () => {
  it("starts on SM-2 and remembers an FSRS choice", async () => {
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    openView("Тохиргоо");

    const sm2 = await screen.findByRole("button", { name: "SM-2" });
    const fsrs = screen.getByRole("button", { name: "FSRS" });
    expect(sm2).toHaveAttribute("aria-pressed", "true");
    expect(fsrs).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(fsrs);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "FSRS" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: "SM-2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // The card explains the grade mapping once FSRS is active.
    expect(
      screen.getByText(/FSRS-4.5, 0\.9 хадгалалтын магадлалтай/),
    ).toBeInTheDocument();
  });
});
