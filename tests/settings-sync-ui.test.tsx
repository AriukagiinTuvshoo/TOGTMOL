// @vitest-environment jsdom
import React, { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { ReviewSettings } from "@/components/settings/review-settings";
import { StudyProvider, useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import type { StudyStore } from "@/lib/persistence/store";
import { knowledgeFixture } from "./knowledge-fixtures";
import { seedGuestStore } from "./store-seed";
import type { StudyData } from "@/types/study";

let store: StudyStore | null = null;

/** Keeps a handle on the store so a test can act like a cloud merge. */
function Capture() {
  const current = useStudy().store;
  useEffect(() => {
    store = current;
  }, [current]);
  return null;
}

function dataWith(extras: Record<string, unknown>): StudyData {
  const base = knowledgeFixture();
  return {
    ...base,
    settings: {
      ...base.settings,
      extras: { ...base.settings.extras, ...extras },
    },
  };
}

async function renderSettings(extras: Record<string, unknown>) {
  await seedGuestStore(dataWith(extras));
  render(
    <LanguageProvider>
      <StudyProvider>
        <Capture />
        <ReviewSettings />
      </StudyProvider>
    </LanguageProvider>,
  );
  const budget = await screen.findByLabelText(/Өдөрт шинэ карт/);
  const limit = screen.getByLabelText(/Нэг давтлагын дээд хэмжээ/);
  return { budget, limit };
}

beforeEach(() => {
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
  store = null;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("review settings after a cloud merge", () => {
  it("shows the values the sync engine merged in, without a reload", async () => {
    const { budget, limit } = await renderSettings({
      newCardsPerDay: 20,
      reviewSessionLimit: 200,
    });
    expect(budget).toHaveValue(20);
    expect(limit).toHaveValue(200);

    const current = store!.getSnapshot().data;
    await store!.mutate(
      actions.settings({
        extras: {
          ...current.settings.extras,
          newCardsPerDay: 7,
          reviewSessionLimit: 150,
        },
      }),
    );

    await waitFor(() => expect(budget).toHaveValue(7));
    expect(limit).toHaveValue(150);
  });

  it("keeps an unsaved draft when another device changes the store", async () => {
    const { budget } = await renderSettings({ newCardsPerDay: 20 });

    fireEvent.change(budget, { target: { value: "9" } });
    expect(budget).toHaveValue(9);

    const current = store!.getSnapshot().data;
    await store!.mutate(
      actions.settings({
        extras: { ...current.settings.extras, newCardsPerDay: 7 },
      }),
    );

    expect(budget).toHaveValue(9);
  });
});
