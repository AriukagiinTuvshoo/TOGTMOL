"use client";

import { useEffect, useRef, useState } from "react";
import { recordedAudioToWav } from "@/lib/assistant/wav";

type VoiceState = "ready" | "starting" | "recording" | "transcribing";
const MAX_RECORDING_MS = 60_000;
const currentTime = () => Date.now();

export function VoiceInput({
  disabled,
  getAccessToken,
  onTranscript,
}: {
  disabled: boolean;
  getAccessToken: () => Promise<string | null>;
  onTranscript: (text: string) => boolean;
}) {
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<VoiceState>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const controller = useRef<AbortController | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discard = useRef(false);
  const mounted = useRef(false);
  const startAttempt = useRef(0);
  const beganAt = useRef(0);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  const clearTimers = () => {
    if (timer.current) clearInterval(timer.current);
    if (hardStop.current) clearTimeout(hardStop.current);
    timer.current = null;
    hardStop.current = null;
  };

  useEffect(() => {
    mounted.current = true;
    const attemptRef = startAttempt;
    return () => {
      mounted.current = false;
      discard.current = true;
      attemptRef.current++;
      if (timer.current) clearInterval(timer.current);
      if (hardStop.current) clearTimeout(hardStop.current);
      controller.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, []);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const begin = async () => {
    if (state !== "ready" || disabled || !consented) return;
    setState("starting");
    setNotice("");
    discard.current = false;
    const attempt = ++startAttempt.current;
    try {
      const accessToken = await getAccessToken();
      if (!mounted.current || attempt !== startAttempt.current) return;
      if (!accessToken)
        throw new Error("Дуугаар бичихэд бүртгэлээр нэвтэрнэ үү.");
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Энэ хөтөч микрофон бичлэгийг дэмжихгүй байна. Шинэчилсэн Chrome эсвэл Safari ашиглана уу.",
        );

      const liveStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (!mounted.current || attempt !== startAttempt.current) {
        liveStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = liveStream;
      const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
      const mimeType = candidates.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const activeRecorder = mimeType
        ? new MediaRecorder(liveStream, { mimeType })
        : new MediaRecorder(liveStream);
      recorder.current = activeRecorder;
      chunks.current = [];
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      activeRecorder.onerror = () => {
        discard.current = true;
        chunks.current = [];
        stopTracks();
        clearTimers();
        if (mounted.current) {
          setState("ready");
          setNotice("Микрофоны бичлэг тасарлаа. Дахин оролдоно уу.");
        }
      };
      activeRecorder.onstop = () => {
        stopTracks();
        clearTimers();
        if (discard.current) {
          chunks.current = [];
          if (mounted.current) setState("ready");
          return;
        }
        void transcribe(accessToken);
      };
      activeRecorder.start(250);
      beganAt.current = currentTime();
      setElapsed(0);
      setState("recording");
      timer.current = setInterval(
        () =>
          setElapsed(
            Math.min(MAX_RECORDING_MS, currentTime() - beganAt.current),
          ),
        250,
      );
      hardStop.current = setTimeout(() => {
        if (activeRecorder.state === "recording") activeRecorder.stop();
      }, MAX_RECORDING_MS);
    } catch (error) {
      stopTracks();
      clearTimers();
      if (mounted.current && attempt === startAttempt.current) {
        setState("ready");
        setNotice(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Микрофоны эрх хаалттай байна. Хөтчийн тохиргооноос зөвшөөрөөд дахин оролдоно уу."
            : error instanceof Error
              ? error.message
              : "Микрофоныг нээж чадсангүй.",
        );
      }
    }
  };

  const transcribe = async (accessToken: string) => {
    if (!mounted.current) return;
    setState("transcribing");
    setNotice("Бичлэгийг текст болгож байна…");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const recording = new Blob(chunks.current, {
        type: recorder.current?.mimeType || "audio/webm",
      });
      chunks.current = [];
      const wav = await recordedAudioToWav(recording);
      if (abort.signal.aborted)
        throw new DOMException("Cancelled", "AbortError");
      if (wav.size > 1_920_044)
        throw new Error(
          "Бичлэгийн хэмжээ хэтэрлээ. 60 секундээс богиноор бичнэ үү.",
        );

      const response = await fetch("/api/chimege/transcribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "audio/wav",
        },
        body: wav,
        signal: abort.signal,
      });
      const result = (await response.json()) as {
        text?: unknown;
        error?: unknown;
      };
      if (!response.ok || typeof result.text !== "string")
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Яриаг текст болгож чадсангүй.",
        );
      if (!mounted.current) return;
      setNotice(
        onTranscriptRef.current(result.text)
          ? "Бичвэрийг орууллаа. Илгээхээсээ өмнө хянаж засаарай."
          : "Оруулах текст 3000 тэмдэгтийн хязгаарт багтсангүй. Одоо байгаа текстээ багасгаад дахин оруулна уу.",
      );
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice("Хөрвүүлэлтийг цуцаллаа.");
      } else {
        setNotice(
          error instanceof Error
            ? error.message
            : "Яриаг текст болгож чадсангүй.",
        );
      }
    } finally {
      controller.current = null;
      if (mounted.current) setState("ready");
    }
  };

  const cancel = () => {
    if (state === "recording" || state === "starting") {
      discard.current = true;
      startAttempt.current++;
      clearTimers();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopTracks();
      setState("ready");
      setNotice("Бичлэгийг цуцаллаа.");
      return;
    }
    if (state === "transcribing") {
      controller.current?.abort();
      setNotice("Хөрвүүлэлтийг цуцалж байна…");
    }
  };

  const time = `${String(Math.floor(elapsed / 60000)).padStart(2, "0")}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}`;
  const recording = state === "recording";
  const pending = state === "starting" || state === "transcribing";

  return (
    <div className="voice-input">
      <label className="check-label voice-consent">
        <input
          type="checkbox"
          checked={consented}
          disabled={state !== "ready" || disabled}
          onChange={(event) => setConsented(event.target.checked)}
        />
        Яриаг Chimege рүү илгээхийг зөвшөөрөх (үйлчилгээний төлбөр гарч болно).
        Өдөрт нийт 20 онлайн хүсэлтийн хязгаарт тооцно.
      </label>
      <div className="voice-controls">
        {recording ? (
          <button
            className="button primary"
            type="button"
            onClick={() => recorder.current?.stop()}
          >
            Бичлэгийг зогсоох · {time}
          </button>
        ) : (
          <button
            className="button"
            type="button"
            disabled={disabled || !consented || pending}
            onClick={() => void begin()}
          >
            {state === "starting"
              ? "Микрофон нээж байна…"
              : state === "transcribing"
                ? "Текст болгож байна…"
                : "🎙️ Яриад бичих"}
          </button>
        )}
        {(recording || pending) && (
          <button className="button" type="button" onClick={cancel}>
            Цуцлах
          </button>
        )}
      </div>
      <p className="tiny muted voice-status" aria-live="polite">
        {notice ||
          "Бичлэг 60 секундэд автоматаар зогсоно. Дууг хадгалахгүй; үүссэн текстийг илгээхээсээ өмнө та шалгана."}
      </p>
    </div>
  );
}
