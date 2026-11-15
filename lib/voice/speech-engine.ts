// Ported & adapted from AriukagiinTuvshoo/voice-app for TOGTMOL Study OS
// Real-time Web Speech API recognizer (MN / EN / JA / AUTO), RMS mic meter, and multi-language TTS.

export type VoiceLangCode = "mn-MN" | "en-US" | "ja-JP" | "auto";

export const VOICE_LANGUAGES: Array<{
  code: VoiceLangCode;
  short: string;
  flag: string;
  label: string;
}> = [
  { code: "mn-MN", short: "MN", flag: "🇲🇳", label: "Монгол (mn-MN)" },
  { code: "auto", short: "AUTO", flag: "🌐", label: "Олон хэл · Авто" },
  { code: "en-US", short: "EN", flag: "🇬🇧", label: "English (en-US)" },
  { code: "ja-JP", short: "JA", flag: "🇯🇵", label: "日本語 (ja-JP)" },
];

export type TtsVoicePreset = "calm" | "broadcast" | "warm" | "crisp";

export const TTS_PRESETS: Array<{
  id: TtsVoicePreset;
  label: string;
  rate: number;
  pitch: number;
}> = [
  { id: "calm", label: "Тайван багш", rate: 0.96, pitch: 1.0 },
  { id: "broadcast", label: "Тод диктор", rate: 1.04, pitch: 0.95 },
  { id: "warm", label: "Дулаан Бондоок", rate: 0.98, pitch: 1.08 },
  { id: "crisp", label: "Хурдан давтлага", rate: 1.18, pitch: 1.02 },
];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export interface SpeechCallbacks {
  onInterim?: (text: string) => void;
  onFinal?: (segment: string, fullText: string) => void;
  onLevel?: (rms: number) => void;
  onStateChange?: (listening: boolean) => void;
  onError?: (friendlyError: string) => void;
}

export class BrowserVoiceSession {
  private recognition: SpeechRecognitionInstance | null = null;
  private keepRunning = false;
  private accumulated = "";
  private lang: VoiceLangCode = "mn-MN";
  private callbacks: SpeechCallbacks;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private rafId: number | null = null;

  constructor(callbacks: SpeechCallbacks, lang: VoiceLangCode = "mn-MN") {
    this.callbacks = callbacks;
    this.lang = lang;
  }

  setLanguage(lang: VoiceLangCode) {
    this.lang = lang;
    if (this.keepRunning) {
      this.stop();
      setTimeout(() => void this.start(lang), 120);
    }
  }

  get isListening() {
    return this.keepRunning;
  }

  async start(lang?: VoiceLangCode): Promise<boolean> {
    if (lang) this.lang = lang;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.callbacks.onError?.(
        "Энэ хөтөч шууд яриа таних (Web Speech API) дэмжихгүй байна. Chrome эсвэл Edge ашиглана уу.",
      );
      return false;
    }

    this.stop();
    this.accumulated = "";
    this.keepRunning = true;

    // Optional mic level visualizer via getUserMedia
    void this.startLevelMeter();

    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this.lang === "auto" ? "mn-MN" : this.lang;

      rec.onresult = (ev) => {
        let interim = "";
        let latestFinal = "";
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          const item = ev.results[i];
          const text = item?.[0]?.transcript ?? "";
          if (item?.isFinal) {
            latestFinal += ` ${text}`;
          } else {
            interim += text;
          }
        }
        if (interim.trim()) {
          this.callbacks.onInterim?.(interim.trim());
        }
        if (latestFinal.trim()) {
          this.accumulated = `${this.accumulated} ${latestFinal.trim()}`.trim();
          this.callbacks.onInterim?.("");
          this.callbacks.onFinal?.(latestFinal.trim(), this.accumulated);
        }
      };

      rec.onerror = (ev) => {
        if (ev.error === "aborted" || ev.error === "no-speech") return;
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          this.keepRunning = false;
          this.cleanupMeter();
          this.callbacks.onStateChange?.(false);
          this.callbacks.onError?.(
            "Микрофоны зөвшөөрөл хаалттай байна. Хөтчийн хаягийн мөр дэх 🔒 тэмдэг дээр дарж Microphone → Allow болгоно уу.",
          );
          return;
        }
        if (ev.error === "network") {
          this.callbacks.onError?.(
            "Яриа таних сүлжээ түр тасарлаа. Интернэт холболтоо шалгана уу.",
          );
        }
      };

      rec.onend = () => {
        if (this.keepRunning) {
          try {
            rec.start();
            return;
          } catch {
            /* fall through */
          }
        }
        this.keepRunning = false;
        this.cleanupMeter();
        this.callbacks.onStateChange?.(false);
      };

      this.recognition = rec;
      rec.start();
      this.callbacks.onStateChange?.(true);
      return true;
    } catch {
      this.keepRunning = false;
      this.cleanupMeter();
      this.callbacks.onStateChange?.(false);
      this.callbacks.onError?.("Яриа танигчийг эхлүүлж чадсангүй.");
      return false;
    }
  }

  stop(): string {
    this.keepRunning = false;
    try {
      this.recognition?.stop();
    } catch {
      /* ignore */
    }
    this.recognition = null;
    this.cleanupMeter();
    this.callbacks.onStateChange?.(false);
    return this.accumulated;
  }

  private async startLevelMeter() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (!this.keepRunning) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      this.audioCtx = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!this.keepRunning) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const norm = (buf[i] - 128) / 128;
          sum += norm * norm;
        }
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.8);
        this.callbacks.onLevel?.(rms);
        this.rafId = window.requestAnimationFrame(tick);
      };
      this.rafId = window.requestAnimationFrame(tick);
    } catch {
      // SpeechRecognition can still run even if separate AudioContext meter fails
    }
  }

  private cleanupMeter() {
    if (this.rafId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.callbacks.onLevel?.(0);
  }
}

// ============================================================
// Multi-Language Browser TTS Speaker (MN / EN / JA)
// ============================================================
export function isTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

export function stopSpeaking() {
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

function detectLanguageForTts(text: string): string {
  if (/[\u3040-\u30ff\u4e00-\u9faf]/.test(text)) return "ja-JP";
  if (/[а-яА-ЯөӨүҮёЁ]/.test(text)) return "mn-MN";
  return "en-US";
}

export function speakText(
  rawText: string,
  options?: {
    preset?: TtsVoicePreset;
    lang?: string;
    onEnd?: () => void;
  },
): boolean {
  if (!isTtsSupported()) return false;
  const cleaned = rawText
    .replace(/[*#`_~>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return false;

  stopSpeaking();

  const utterance = new window.SpeechSynthesisUtterance(cleaned);
  const targetLang = options?.lang || detectLanguageForTts(cleaned);
  utterance.lang = targetLang;

  const presetCfg =
    TTS_PRESETS.find((p) => p.id === (options?.preset ?? "warm")) ??
    TTS_PRESETS[2];
  utterance.rate = presetCfg.rate;
  utterance.pitch = presetCfg.pitch;

  const voices = window.speechSynthesis.getVoices();
  const exact =
    voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
    voices.find((v) =>
      v.lang.toLowerCase().startsWith(targetLang.slice(0, 2).toLowerCase()),
    );
  if (exact) {
    utterance.voice = exact;
  }

  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}
