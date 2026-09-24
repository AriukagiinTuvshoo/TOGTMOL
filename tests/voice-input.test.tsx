/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceInput } from "@/components/assistant/voice-input";

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["recording"]) });
    this.onstop?.();
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mobile voice input flow", () => {
  it("requires consent, records, sends WAV and inserts editable text without submitting the chat", async () => {
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }),
      },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: class {
        decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
        close = vi.fn().mockResolvedValue(undefined);
      },
    });
    Object.defineProperty(window, "OfflineAudioContext", {
      configurable: true,
      value: class {
        destination = {};
        createBufferSource() {
          return { buffer: null, connect: vi.fn(), start: vi.fn() };
        }
        startRendering() {
          return Promise.resolve({
            getChannelData: () => new Float32Array(16000),
          });
        }
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ text: "Өнөөдөр математик давтана." }));
    vi.stubGlobal("fetch", fetchMock);
    const onTranscript = vi.fn(() => true);
    render(
      <VoiceInput
        disabled={false}
        getAccessToken={async () => "access-token"}
        onTranscript={onTranscript}
      />,
    );

    const start = screen.getByRole("button", { name: /Яриад бичих/ });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((start as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(start);
    expect(
      await screen.findByRole("button", { name: /Бичлэгийг зогсоох/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Бичлэгийг зогсоох/ }));

    await waitFor(() =>
      expect(onTranscript).toHaveBeenCalledWith("Өнөөдөр математик давтана."),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "audio/wav",
      },
    });
    expect(track.stop).toHaveBeenCalled();
  });
});
