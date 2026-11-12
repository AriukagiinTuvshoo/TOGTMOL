// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { AppShell } from "@/components/app-shell";

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
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("mobile shell navigation", () => {
  it("opens the more sheet as a dialog, moves focus inside, and closes on Escape", async () => {
    render(<AppShell />);
    await screen.findByText("Миний төлөвлөгөө");
    const mobileNav = screen.getByRole("navigation", {
      name: "Гар утасны цэс",
    });
    const trigger = within(mobileNav).getByRole("button", { name: "Бусад" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "mobile-more-panel");

    fireEvent.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: "Бусад" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(sheet.contains(document.activeElement)).toBe(true),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Бусад" })).toBeNull(),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("translates the mobile navigation landmark", async () => {
    localStorage.setItem("togtmol-language", "en");
    render(<AppShell />);
    const nav = await screen.findByRole("navigation", { name: "Mobile menu" });
    expect(within(nav).getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });
});
