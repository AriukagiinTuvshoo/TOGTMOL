// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  processVoiceTranscript,
  restoreCodeSwitchingTerms,
} from "@/lib/voice/text-processor";
import { matchVoiceCommand } from "@/lib/voice/commands";
import {
  clearGeminiConfig,
  readGeminiConfig,
  writeGeminiConfig,
} from "@/lib/assistant/gemini";
import {
  GET as geminiGet,
  POST as geminiPost,
} from "@/app/api/bondook/gemini/route";
import { deck1Bridge, readSavedMixes } from "@/lib/v9/audio-bridge";
import { engine } from "@/lib/v9/audio-engine";
import { AppShell } from "@/components/app-shell";

describe("TOGTMOL v10 · Voice OS, Google AI Studio & Unified 3-Deck Audio", () => {
  beforeEach(() => {
    cleanup();
    vi.stubGlobal("indexedDB", new IDBFactory());
    localStorage.clear();
    clearGeminiConfig();
    window.location.hash = "";
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("dark"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
  });

  it("restores Mongolian/English/Japanese code-switching terms and cleans fillers", () => {
    expect(
      restoreCodeSwitchingTerms(
        "би ви эс код дээр тайп скрипт болон жемини туршив",
      ),
    ).toContain("VS Code");
    expect(
      restoreCodeSwitchingTerms("конничива сенсей жи эл пи ти бэлдье"),
    ).toContain("こんにちは");
    expect(restoreCodeSwitchingTerms("Reactийн бүтэц")).toBe("React-ийн бүтэц");

    const cleaned = processVoiceTranscript(
      "нөгөө өнөөдөр юу гэдэг юм жемини яаж ажилладаг вэ",
    );
    expect(cleaned).toBe("Өнөөдөр Gemini яаж ажилладаг вэ?");
  });

  it("parses hands-free Mongolian & English voice commands into structured actions", () => {
    expect(matchVoiceCommand("Фокус эхэл")).toEqual({
      kind: "timer_start",
      mode: "focus",
    });
    expect(matchVoiceCommand("түр зогс")).toEqual({ kind: "timer_pause" });
    expect(matchVoiceCommand("бороо асаа")).toEqual({
      kind: "sound_preset",
      presetId: "rainy-cafe",
      label: "Бороотой Кафе",
    });
    expect(matchVoiceCommand("гүн шөнө")).toEqual({
      kind: "sound_preset",
      presetId: "deep-night",
      label: "Гүн Шөнө",
    });
    expect(matchVoiceCommand("ойн үүр")).toEqual({
      kind: "sound_preset",
      presetId: "forest-dawn",
      label: "Ойн Үүр",
    });
    expect(matchVoiceCommand("номын сангийн дуу")).toEqual({
      kind: "sound_preset",
      presetId: "library-hush",
      label: "Номын Сан",
    });
    expect(matchVoiceCommand("сансар асаа")).toEqual({
      kind: "sound_preset",
      presetId: "deep-space",
      label: "Сансар",
    });
    expect(matchVoiceCommand("галын илч")).toEqual({
      kind: "sound_preset",
      presetId: "cabin-fire",
      label: "Галын Илч",
    });
    expect(matchVoiceCommand("дуу зогсоо")).toEqual({ kind: "sound_stop" });
    expect(matchVoiceCommand("даалгавар нэм: Физикийн 5 бодлого")).toEqual({
      kind: "add_task",
      title: "Физикийн 5 бодлого",
    });
    expect(
      matchVoiceCommand("тэмдэглэл хадгал: Ньютоны 2-р хууль F=ma"),
    ).toEqual({
      kind: "add_note",
      body: "Ньютоны 2-р хууль F=ma",
    });
    expect(matchVoiceCommand("Бондоок оо, интеграл гэж юу вэ?")).toEqual({
      kind: "ask_bondook",
      prompt: "интеграл гэж юу вэ?",
    });
  });

  it("manages device-local Google AI Studio config and handles AQ. / AIza keys on the Gemini route", async () => {
    expect(readGeminiConfig().enabled).toBe(false);
    writeGeminiConfig({
      enabled: true,
      apiKey: "AQ.test-express-key",
      model: "gemini-2.5-flash",
    });
    expect(readGeminiConfig()).toEqual({
      enabled: true,
      apiKey: "AQ.test-express-key",
      model: "gemini-2.5-flash",
    });

    const statusRes = await geminiGet();
    const statusJson = (await statusRes.json()) as {
      configuredOnServer: boolean;
      defaultModel: string;
    };
    expect(typeof statusJson.configuredOnServer).toBe("boolean");
    expect(statusJson.defaultModel).toBe("gemini-2.5-flash");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      cards: [
                        { front: "Ньютоны 2-р хууль?", back: "F = m * a" },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const postReq = new Request("http://localhost/api/bondook/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": "AQ.sample-key",
        "x-gemini-model": "gemini-2.5-flash",
      },
      body: JSON.stringify({
        kind: "cards",
        text: "Ньютоны хоёрдугаар хууль нь хүч ба хурдатгалын хамаарлыг илэрхийлнэ: F = m * a.",
        count: 1,
        language: "mn",
      }),
    });

    const postRes = await geminiPost(postReq);
    expect(postRes.status).toBe(200);
    const cardsPayload = (await postRes.json()) as {
      cards: Array<{ front: string; back: string }>;
    };
    expect(cardsPayload.cards).toHaveLength(1);
    expect(cardsPayload.cards[0]?.front).toContain("Ньютон");
    // AQ. key should hit Vertex AI Express endpoint first and pass key via header (never query string)
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    const calledInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(calledUrl).toContain("aiplatform.googleapis.com");
    expect(calledUrl).not.toContain("key=");
    expect(calledUrl).not.toContain("AQ.sample-key");
    expect(
      (calledInit?.headers as Record<string, string> | undefined)?.[
        "x-goog-api-key"
      ],
    ).toBe("AQ.sample-key");

    vi.unstubAllGlobals();
  });

  it("synchronizes Unified 3-Deck Audio Bridge, custom mixes, and timer auto-ducking", () => {
    const mixes = readSavedMixes({
      savedMixes: [
        {
          id: "mix-1",
          name: "Бороотой код",
          createdAt: 100,
          deck1Selected: "ambient:rain",
          channels: { rain: 0.5, cafe: 0.25 },
        },
      ],
    });
    expect(mixes).toHaveLength(1);
    expect(mixes[0]?.name).toBe("Бороотой код");

    engine.applyCustomMix({ rain: 0.42, purr: 0.2 });
    expect(engine.getSnapshot().mix.rain).toBeCloseTo(0.42, 2);
    engine.setDuckFactor(0.45);
    engine.stopAll(0);

    let latestTitle = "";
    const unsub = deck1Bridge.subscribe((s) => {
      latestTitle = s.name;
    });
    deck1Bridge.publish(
      {
        ...deck1Bridge.getState(),
        ready: true,
        name: "Lo-Fi Study Stream",
        playing: true,
      },
      {
        toggle: vi.fn(),
        stop: vi.fn(),
        next: vi.fn(),
        select: vi.fn(),
        setOpen: vi.fn(),
        setVolume: vi.fn(),
        toggleMute: vi.fn(),
        addUrl: vi.fn().mockResolvedValue(undefined),
        addFile: vi.fn().mockResolvedValue(undefined),
        removeSource: vi.fn().mockResolvedValue(undefined),
      },
    );
    expect(latestTitle).toBe("Lo-Fi Study Stream");
    unsub();
    deck1Bridge.clear();
  });

  it("renders accessible Voice, Quick Tools & Login controls in header and eliminates duplicate Room heading", async () => {
    window.location.hash = "#/room";
    render(<AppShell />);

    // Wait for both IndexedDB hydration (state.ready) and CustomizeRoom dynamic chunk
    await screen.findByText("ROOM & BONDOOK STUDIO");
    const headings = screen.getAllByText("Таны жижиг ертөнц");
    // Only ONE visible page heading instead of duplicate SectionTitle + page-top
    expect(headings).toHaveLength(1);

    // Header accessible triggers
    expect(screen.getByLabelText("Дуу хоолойн удирдлага")).toBeInTheDocument();
    expect(screen.getByLabelText("Оюутны түргэн хэрэгсэл")).toBeInTheDocument();

    const authBtn = screen.getByLabelText("Нэвтрэх ба бүртгэл");
    fireEvent.click(authBtn);

    const googleTab = await screen.findByRole("tab", { name: /Google AI/i });
    fireEvent.click(googleTab);
    expect(
      await screen.findByText(/Google AI Studio API Түлхүүр/i),
    ).toBeInTheDocument();
  });
});
