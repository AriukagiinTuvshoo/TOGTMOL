// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { StudyProvider, useStudy } from "@/hooks/use-study";
import { CardReview } from "@/components/knowledge/review";
import { dataWithFreshCards, seedGuestStore } from "./store-seed";

function Ready({ children }: { children: React.ReactNode }) {
  const { data } = useStudy();
  return data.knowledge.some((r) => r.kind === "card") ? (
    <>{children}</>
  ) : (
    <p>Ачаалж байна…</p>
  );
}

let now = new Date("2026-09-15T12:00:00").getTime();

beforeEach(() => {
  now = new Date("2026-09-15T12:00:00").getTime();
  vi.spyOn(Date, "now").mockImplementation(() => now);
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

async function openReview(deckId?: string) {
  const onClose = vi.fn();
  render(
    <StudyProvider>
      <Ready>
        <CardReview deckId={deckId} onClose={onClose} />
      </Ready>
    </StudyProvider>,
  );
  await screen.findByText(/үлдсэн/, {}, { timeout: 4000 });
  return onClose;
}

describe("review window controls", () => {
  it("shows the whole queue and re-filters it by deck", async () => {
    await seedGuestStore(dataWithFreshCards(["Багц A", "Багц B"], 6));
    await openReview();
    const deck = screen.getByLabelText("Багц") as HTMLSelectElement;
    expect(deck.value).toBe("");
    expect(screen.getByText("12 үлдсэн")).toBeInTheDocument();

    fireEvent.change(deck, { target: { value: "seed-deck-1" } });
    expect(screen.getByText("6 үлдсэн")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Багц B: асуулт/ }),
    ).toBeInTheDocument();

    fireEvent.change(deck, { target: { value: "" } });
    expect(screen.getByText("12 үлдсэн")).toBeInTheDocument();
  });

  it("preselects the deck the session was opened from", async () => {
    await seedGuestStore(dataWithFreshCards(["Багц A", "Багц B"], 3));
    await openReview("seed-deck-0");
    expect((screen.getByLabelText("Багц") as HTMLSelectElement).value).toBe(
      "seed-deck-0",
    );
    expect(screen.getByText("3 үлдсэн")).toBeInTheDocument();
  });

  it("starts a time box, warns when it runs out and can extend it", async () => {
    await seedGuestStore(dataWithFreshCards(["Багц A"], 2));
    const onClose = await openReview();
    fireEvent.change(screen.getByLabelText("Хугацаа"), {
      target: { value: "10" },
    });
    expect(await screen.findByText("Үлдсэн 10:00")).toBeInTheDocument();

    // The countdown reads the clock on its own interval.
    now += 11 * 60 * 1000;
    expect(
      await screen.findByText("Цаг дууслаа", {}, { timeout: 4000 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "10 минут нэмэх" }));
    expect(await screen.findByText("Үлдсэн 10:00")).toBeInTheDocument();
    expect(screen.queryByText("Цаг дууслаа")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // Running out again offers the same choice; this time the session ends.
    now += 11 * 60 * 1000;
    expect(
      await screen.findByText("Цаг дууслаа", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Дуусгах" }));
    expect(onClose).toHaveBeenCalled();
  });
});
