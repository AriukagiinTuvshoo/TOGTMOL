// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readLimitedBody, stripJsonFence } from "@/lib/http/request";
import {
  dynamic as geminiDynamic,
  POST as geminiPost,
  runtime as geminiRuntime,
} from "@/app/api/bondook/gemini/route";
import { matchVoiceCommand } from "@/lib/voice/commands";
import { PRESETS, SoundEngine } from "@/lib/v9/audio-engine";
import { ROOMS } from "@/lib/v9/rooms";
import {
  BrowserVoiceSession,
  MAX_NETWORK_RETRIES,
} from "@/lib/voice/speech-engine";
import { RoomBackground } from "@/components/v9/room-background";
import { CoFocusWidget } from "@/components/v9/cofocus-widget";
import { VoiceFlowBar } from "@/components/v9/voice-flowbar";
import { StudyProvider, useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { Repository } from "@/lib/persistence/repository";
import * as supabaseModule from "@/lib/supabase/client";
import PrivacyPage from "@/app/privacy/page";
import { fixture } from "./fixtures";
import { SAMPLE_IMAGE } from "./knowledge-fixtures";

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("lib/http/request helpers", () => {
  it("enforces streaming and Content-Length limits and reads utf8/bytes", async () => {
    const okText = await readLimitedBody(
      new Request("http://localhost/test", { method: "POST", body: "Сайн уу" }),
      64,
    );
    expect(okText).toMatchObject({ ok: true, value: "Сайн уу" });

    const okBytes = await readLimitedBody(
      new Request("http://localhost/test", {
        method: "POST",
        body: new Uint8Array([1, 2, 3, 4]),
      }),
      8,
      "bytes",
    );
    expect(okBytes.ok).toBe(true);
    if (okBytes.ok) {
      expect(Array.from(okBytes.value)).toEqual([1, 2, 3, 4]);
    }

    const tooLarge = await readLimitedBody(
      new Request("http://localhost/test", {
        method: "POST",
        body: "x".repeat(128),
      }),
      32,
    );
    expect(tooLarge).toEqual({ ok: false, reason: "too_large" });

    const empty = await readLimitedBody(
      new Request("http://localhost/test", { method: "POST" }),
      32,
    );
    expect(empty).toEqual({ ok: false, reason: "empty" });
  });

  it("strips Markdown JSON code fences cleanly", () => {
    expect(stripJsonFence('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(stripJsonFence("```\n[1, 2]\n```")).toBe("[1, 2]");
    expect(stripJsonFence('  {"plain":1}  ')).toBe('{"plain":1}');
  });
});

describe("app/api/bondook/gemini security hardening", () => {
  const geminiReq = (body: unknown, apiKey = "AIzaTestStudioKey123") =>
    new Request("http://localhost/api/bondook/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

  it("exports nodejs runtime and force-dynamic and sends API key via x-goog-api-key header", async () => {
    expect(geminiRuntime).toBe("nodejs");
    expect(geminiDynamic).toBe("force-dynamic");

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [{ content: { parts: [{ text: "Сайн байна уу!" }] } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await geminiPost(
      geminiReq({
        kind: "chat",
        message: "Физик тайлбарла",
        context: { today: "2026-11-16" },
      }),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(url).not.toContain("?key=");
    expect(url).not.toContain("AIzaTestStudioKey123");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "AIzaTestStudioKey123",
    );
  });

  it("rejects invalid or >2MB images and >15000-char snap text with 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    title: "Хичээл",
                    summaryMarkdown: "## Тэмдэглэл",
                    cards: [],
                    questions: [],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Invalid URL image
    expect(
      (
        await geminiPost(
          geminiReq({
            kind: "snap",
            image: "https://evil.example/a.png",
            text: "hint",
          }),
        )
      ).status,
    ).toBe(400);

    // Disallowed MIME (SVG)
    expect(
      (
        await geminiPost(
          geminiReq({
            kind: "cards",
            text: "Материал",
            count: 2,
            image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
          }),
        )
      ).status,
    ).toBe(400);

    // Malformed base64 characters
    expect(
      (
        await geminiPost(
          geminiReq({
            kind: "snap",
            image: "data:image/png;base64,not valid base64$$$",
          }),
        )
      ).status,
    ).toBe(400);

    // Oversized image (>2MB string, still under 3MB request body limit)
    const hugeBase64 =
      "data:image/png;base64," + "A".repeat(2 * 1024 * 1024 + 4);
    expect(
      (await geminiPost(geminiReq({ kind: "snap", image: hugeBase64 }))).status,
    ).toBe(400);

    // Oversized snap text (>15,000 chars)
    expect(
      (await geminiPost(geminiReq({ kind: "snap", text: "а".repeat(15_001) })))
        .status,
    ).toBe(400);

    // Non-object JSON body
    expect((await geminiPost(geminiReq(null))).status).toBe(400);

    expect(fetchMock).not.toHaveBeenCalled();

    // Valid PNG base64 succeeds
    const validRes = await geminiPost(
      geminiReq({ kind: "snap", image: SAMPLE_IMAGE, text: "Алгебр" }),
    );
    expect(validRes.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("voice presets, timer_finish, speech backoff & audio node cleanup", () => {
  it("aligns all voice sound_preset IDs with PRESETS in audio-engine", () => {
    const validIds = new Set(PRESETS.map((p) => p.id));
    const phrases = [
      ["бороо асаа", "rainy-cafe"],
      ["гүн шөнө", "deep-night"],
      ["ойн үүр", "forest-dawn"],
      ["номын сангийн дуу", "library-hush"],
      ["сансар асаа", "deep-space"],
      ["галын илч", "cabin-fire"],
    ] as const;

    const testEngine = new SoundEngine();
    for (const [phrase, expectedId] of phrases) {
      const cmd = matchVoiceCommand(phrase);
      expect(cmd).toMatchObject({ kind: "sound_preset", presetId: expectedId });
      expect(validIds.has(expectedId)).toBe(true);
      testEngine.applyPreset(expectedId);
      expect(testEngine.getSnapshot().activePreset).toBe(expectedId);
      expect(testEngine.getSnapshot().activeCount).toBeGreaterThan(0);
    }
    testEngine.stopAll(0);
  });

  it("disconnects both GainNode and StereoPannerNode in syncLiveChannel and stopAll", () => {
    vi.useFakeTimers();
    const gainDisconnects: Array<ReturnType<typeof vi.fn>> = [];
    const panDisconnects: Array<ReturnType<typeof vi.fn>> = [];

    class MockAudioContext {
      state = "running";
      sampleRate = 8000;
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createGain() {
        const disconnect = vi.fn();
        gainDisconnects.push(disconnect);
        return {
          gain: {
            value: 1,
            setTargetAtTime: vi.fn(),
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect,
        };
      }
      createStereoPanner() {
        const disconnect = vi.fn();
        panDisconnects.push(disconnect);
        return {
          pan: { value: 0, setTargetAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect,
        };
      }
      createBuffer(_channels: number, length: number) {
        return { getChannelData: () => new Float32Array(length) };
      }
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
    }

    vi.stubGlobal("AudioContext", MockAudioContext);
    const sfx = new SoundEngine();

    // 1. syncLiveChannel fade-out disconnects both gain and pan
    sfx.setChannel("white", 0.5, -0.2);
    expect(panDisconnects).toHaveLength(1);
    const whitePanDisconnect = panDisconnects[0]!;
    const whiteGainDisconnect = gainDisconnects[1]!; // [0] is masterNode
    sfx.setChannel("white", 0);
    vi.advanceTimersByTime(1000);
    expect(whiteGainDisconnect).toHaveBeenCalledTimes(1);
    expect(whitePanDisconnect).toHaveBeenCalledTimes(1);

    // 2. stopAll disconnects both gain and pan
    sfx.setChannel("brown", 0.6, 0.3);
    expect(panDisconnects).toHaveLength(2);
    const brownPanDisconnect = panDisconnects[1]!;
    const brownGainDisconnect = gainDisconnects[2]!;
    sfx.stopAll(200);
    vi.advanceTimersByTime(400);
    expect(brownGainDisconnect).toHaveBeenCalledTimes(1);
    expect(brownPanDisconnect).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially on SpeechRecognition network errors, caps retries, and cancels setLanguage timeout on stop()", async () => {
    vi.useFakeTimers();

    interface FakeRec {
      lang: string;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      abort: ReturnType<typeof vi.fn>;
      onresult: ((ev: unknown) => void) | null;
      onerror: ((ev: { error: string }) => void) | null;
      onend: (() => void) | null;
    }

    const instances: FakeRec[] = [];
    class MockSpeechRecognition implements FakeRec {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((ev: unknown) => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        instances.push(this);
      }
    }

    (
      window as unknown as { SpeechRecognition: typeof MockSpeechRecognition }
    ).SpeechRecognition = MockSpeechRecognition;

    const states: boolean[] = [];
    const errors: string[] = [];
    const session = new BrowserVoiceSession({
      onStateChange: (on) => states.push(on),
      onError: (msg) => errors.push(msg),
    });

    await session.start("mn-MN");
    const rec = instances[0]!;
    expect(rec.start).toHaveBeenCalledTimes(1);

    // Simulate repeated network errors: must wait exponential delays (500, 1000, 2000ms)
    const expectedDelays = [500, 1000, 2000];
    for (let i = 0; i < MAX_NETWORK_RETRIES; i += 1) {
      const callsBefore = rec.start.mock.calls.length;
      rec.onerror?.({ error: "network" });
      rec.onend?.();
      // Does NOT synchronously restart in an infinite loop
      expect(rec.start).toHaveBeenCalledTimes(callsBefore);
      vi.advanceTimersByTime(expectedDelays[i]! - 1);
      expect(rec.start).toHaveBeenCalledTimes(callsBefore);
      vi.advanceTimersByTime(1);
      expect(rec.start).toHaveBeenCalledTimes(callsBefore + 1);
    }

    // One more network error exceeds MAX_NETWORK_RETRIES -> stops cleanly
    const finalStartCount = rec.start.mock.calls.length;
    rec.onerror?.({ error: "network" });
    rec.onend?.();
    vi.advanceTimersByTime(30_000);
    expect(rec.start).toHaveBeenCalledTimes(finalStartCount);
    expect(session.isListening).toBe(false);
    expect(states[states.length - 1]).toBe(false);
    expect(errors.length).toBeGreaterThan(0);

    // Verify setLanguage pending timeout is cancelled when stop() is called
    await session.start("mn-MN");
    const countBeforeSwitch = instances.length;
    session.setLanguage("ja-JP");
    session.stop();
    vi.advanceTimersByTime(500);
    expect(instances).toHaveLength(countBeforeSwitch);
    expect(session.isListening).toBe(false);

    delete (
      window as unknown as { SpeechRecognition?: typeof MockSpeechRecognition }
    ).SpeechRecognition;
  });

  it("finishes the active timer via actions.finish() on voice command 'цаг дуусга'", async () => {
    const started = actions.start("math", "pomodoro", "focus", 25)(fixture());
    const seeded = {
      ...started,
      activeTimer: {
        ...started.activeTimer!,
        startedAt: Date.now() - 60_000,
        accumulatedMs: 60_000,
      },
    };
    const repo = new Repository();
    await repo.save("guest", seeded, 0);
    await repo.close();

    interface MockRec {
      onfinalTrigger?: (text: string) => void;
    }
    const holder: MockRec = {};
    class MockSpeech {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult:
        | ((ev: {
            resultIndex: number;
            results: {
              length: number;
              0: {
                isFinal: boolean;
                length: number;
                0: { transcript: string; confidence: number };
              };
            };
          }) => void)
        | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        holder.onfinalTrigger = (transcript: string) => {
          this.onresult?.({
            resultIndex: 0,
            results: {
              length: 1,
              0: {
                isFinal: true,
                length: 1,
                0: { transcript, confidence: 1 },
              },
            },
          });
        };
      }
      stop() {}
      abort() {}
    }
    (
      window as unknown as { SpeechRecognition: typeof MockSpeech }
    ).SpeechRecognition = MockSpeech;

    const onNavigate = vi.fn();
    function Harness() {
      const { data } = useStudy();
      return (
        <div>
          <span data-testid="timer-status">
            {data.activeTimer?.status ?? "none"}
          </span>
          <span data-testid="session-count">{data.sessions.length}</span>
          <VoiceFlowBar open onClose={() => {}} onNavigate={onNavigate} />
        </div>
      );
    }

    render(
      <StudyProvider>
        <Harness />
      </StudyProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("timer-status")).toHaveTextContent("active"),
    );
    const sessionsBefore = Number(
      screen.getByTestId("session-count").textContent,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ярьж эхлэх" }));
    await act(async () => {
      holder.onfinalTrigger?.("цаг дуусга");
    });

    await waitFor(() =>
      expect(screen.getByTestId("timer-status")).toHaveTextContent("review"),
    );
    expect(Number(screen.getByTestId("session-count").textContent)).toBe(
      sessionsBefore + 1,
    );
    expect(onNavigate).toHaveBeenCalledWith("overview");

    delete (window as unknown as { SpeechRecognition?: typeof MockSpeech })
      .SpeechRecognition;
  });
});

describe("SSR hydration fixes, Co-Focus cleanup & Privacy disclosures", () => {
  it("hydrates RoomBackground skyOverlay inside useEffect and updates on interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 16, 7, 0, 0)); // 07:00 morning

    const { container } = render(
      <RoomBackground room={ROOMS[0]!} autoDayNight />,
    );
    const overlay = () =>
      container.querySelector<HTMLDivElement>("[data-sky-overlay]");
    // Before effect timer fires: no client-clock sky overlay div (matches SSR)
    expect(overlay()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(overlay()).not.toBeNull();
    expect(overlay()?.style.background).toMatch(/251,\s*191,\s*36/);

    // Advance clock to 23:00 night and trigger periodic refresh
    vi.setSystemTime(new Date(2026, 10, 16, 23, 0, 0));
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(overlay()?.style.background).toMatch(/2,\s*6,\s*23/);
  });

  it("hydrates CoFocusWidget from URL/localStorage in useEffect and calls removeChannel on cleanup", async () => {
    const removeChannel = vi.fn().mockResolvedValue("ok");
    const unsubscribe = vi.fn().mockResolvedValue("ok");
    const fakeChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue("ok"),
      unsubscribe,
    };
    const fakeClient = {
      channel: vi.fn().mockReturnValue(fakeChannel),
      removeChannel,
    };
    vi.spyOn(supabaseModule, "getSupabase").mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseModule.getSupabase>,
    );

    window.history.replaceState(null, "", "/?cofocus=ub2026");
    window.localStorage.setItem("togtmol:cofocus:nick", "Түвшөө");

    const { unmount } = render(<CoFocusWidget />);

    expect(await screen.findByText("#UB2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Таны нэр")).toHaveValue("Түвшөө");
    expect(fakeClient.channel).toHaveBeenCalledWith("cofocus:UB2026");

    unmount();
    expect(removeChannel).toHaveBeenCalledWith(fakeChannel);
  });

  it("documents Gemini, Chimege STT, and Co-Focus Supabase Realtime in PrivacyPage", () => {
    render(<PrivacyPage />);
    expect(
      screen.getAllByText(/Google AI Studio \/ Vertex AI/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chimege STT/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Supabase Realtime Broadcast/i).length,
    ).toBeGreaterThan(0);
  });
});
