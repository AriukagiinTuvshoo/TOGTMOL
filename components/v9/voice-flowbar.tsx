"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  X,
  Check,
  Copy,
  FilePlus2,
  Wand2,
} from "lucide-react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { engine } from "@/lib/v9/audio-engine";
import { deck1Bridge } from "@/lib/v9/audio-bridge";
import { ROOMS } from "@/lib/v9/rooms";
import {
  BrowserVoiceSession,
  VOICE_LANGUAGES,
  isBrowserSpeechSupported,
  speakText,
  type VoiceLangCode,
} from "@/lib/voice/speech-engine";
import { processVoiceTranscript } from "@/lib/voice/text-processor";
import { matchVoiceCommand } from "@/lib/voice/commands";
import type { StudyNote } from "@/types/knowledge";
import type { View } from "@/types/study";

export interface VoiceFlowBarProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View | "sound") => void;
  onAskBondook?: (prompt: string) => void;
  accent?: string;
}

export function VoiceFlowBar({
  open,
  onClose,
  onNavigate,
  onAskBondook,
  accent = "#f59e0b",
}: VoiceFlowBarProps) {
  const { data, store, today } = useStudy();
  const [lang, setLang] = useState<VoiceLangCode>("mn-MN");
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [cleanFillers, setCleanFillers] = useState(true);
  const [speakFeedback, setSpeakFeedback] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const sessionRef = useRef<BrowserVoiceSession | null>(null);
  const lastFocusedInputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);

  // Track last focused text input/textarea outside the FlowBar so dictation can insert directly
  useEffect(() => {
    const onFocusIn = (ev: FocusEvent) => {
      const target = ev.target;
      if (
        (target instanceof HTMLInputElement &&
          ["text", "search", "url", ""].includes(target.type)) ||
        target instanceof HTMLTextAreaElement
      ) {
        if (!target.closest(".v10-voice-flowbar")) {
          lastFocusedInputRef.current = target;
        }
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const announce = useCallback(
    (msg: string) => {
      setFeedback(msg);
      if (speakFeedback) {
        speakText(msg, { preset: "warm" });
      }
    },
    [speakFeedback],
  );

  const executeOrDictate = useCallback(
    async (rawSegment: string) => {
      const cmd = matchVoiceCommand(rawSegment);
      if (cmd) {
        switch (cmd.kind) {
          case "timer_start": {
            if (data.activeTimer) {
              if (!data.activeTimer.running) {
                await store.mutate(actions.resume(), {
                  reportError: false,
                  reportBusy: false,
                });
                announce("Цаг хэмжигчийг үргэлжлүүллээ.");
              } else {
                announce("Фокус цаг аль хэдийн ажиллаж байна.");
              }
              return;
            }
            await store.mutate(
              (d) => {
                let next = d;
                let subj = next.subjects.find(
                  (s) => !s.deletedAt && !s.archived,
                );
                if (!subj) {
                  next = actions.addSubject("Ерөнхий сургалт", "#a78bfa")(next);
                  subj = next.subjects.find((s) => !s.deletedAt && !s.archived);
                }
                if (!subj) return next;
                const phase = cmd.mode ?? "focus";
                const mins =
                  phase === "focus"
                    ? next.settings.focusMinutes || 25
                    : next.settings.shortBreakMinutes || 5;
                return actions.start(subj.id, "pomodoro", phase, mins)(next);
              },
              { reportError: false, reportBusy: false },
            );
            announce("Фокус цаг эхэллээ. Амжилт хүсье!");
            return;
          }
          case "timer_pause": {
            await store.mutate(actions.pause(), {
              reportError: false,
              reportBusy: false,
            });
            announce("Цаг хэмжигчийг түр зогсоолоо.");
            return;
          }
          case "timer_resume": {
            await store.mutate(actions.resume(), {
              reportError: false,
              reportBusy: false,
            });
            announce("Цаг хэмжигч үргэлжилж байна.");
            return;
          }
          case "timer_finish": {
            onNavigate("overview");
            announce("Фокус өрөө рүү шилжлээ.");
            return;
          }
          case "sound_preset": {
            engine.applyPreset(cmd.presetId);
            announce(`${cmd.label} орчны дууг асаалаа.`);
            return;
          }
          case "sound_stop": {
            engine.stopAll();
            deck1Bridge.getActions()?.stop();
            announce("Бүх дуу болон хөгжмийг зогсоолоо.");
            return;
          }
          case "room_change": {
            const roomDef = ROOMS.find((r) => r.id === cmd.roomId);
            if (roomDef) {
              await store.mutate(
                (d) =>
                  actions.settings({
                    world: {
                      ...d.settings.world,
                      design: roomDef.id,
                      extras: {
                        ...d.settings.world.extras,
                        v9Room: roomDef.id,
                      },
                    },
                  })(d),
                { reportError: false, reportBusy: false },
              );
              announce(`${cmd.label} өрөө рүү солилоо.`);
            }
            return;
          }
          case "navigate": {
            onNavigate(cmd.view);
            announce(`${cmd.label} хэсгийг нээлээ.`);
            return;
          }
          case "add_task": {
            await store.mutate(
              (d) => {
                let next = d;
                let subj = next.subjects.find(
                  (s) => !s.deletedAt && !s.archived,
                );
                if (!subj) {
                  next = actions.addSubject("Ерөнхий сургалт", "#a78bfa")(next);
                  subj = next.subjects.find((s) => !s.deletedAt && !s.archived);
                }
                if (!subj) return next;
                return actions.addTask({
                  subjectId: subj.id,
                  date: today,
                  minutes: 25,
                  title: cmd.title,
                  startTime: null,
                })(next);
              },
              { reportError: false, reportBusy: false },
            );
            announce(`"${cmd.title}" даалгаврыг өнөөдрийн жагсаалтад нэмлээ.`);
            return;
          }
          case "add_note": {
            const note: StudyNote = {
              ...recordBase(
                cmd.body.slice(0, 48) || "Дуу хоолойн тэмдэглэл",
                null,
              ),
              kind: "note",
              date: today,
              body: cmd.body,
              tags: ["voice"],
              image: null,
              links: [],
            };
            await store.mutate(saveKnowledge(note), {
              reportError: false,
              reportBusy: false,
            });
            announce("Тэмдэглэлийг Мэдлэг санд хадгаллаа.");
            return;
          }
          case "ask_bondook": {
            onNavigate("assistant");
            onAskBondook?.(cmd.prompt);
            announce("Бондоок руу асуултыг илгээлээ.");
            return;
          }
        }
      }

      // Otherwise treat as smart dictation (MN + EN + JP code-switching restored!)
      const processed = processVoiceTranscript(rawSegment, {
        removeFillers: cleanFillers,
        restoreTerms: true,
        autoPunctuate: true,
      });
      if (!processed) return;

      setTranscript((prev) => (prev ? `${prev} ${processed}` : processed));

      const activeField = lastFocusedInputRef.current;
      if (activeField && document.body.contains(activeField)) {
        const prevVal = activeField.value;
        const nextVal = prevVal ? `${prevVal} ${processed}` : processed;
        const proto =
          activeField instanceof HTMLTextAreaElement
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) {
          setter.call(activeField, nextVal);
          activeField.dispatchEvent(new Event("input", { bubbles: true }));
          activeField.dispatchEvent(new Event("change", { bubbles: true }));
          setFeedback("Идэвхтэй талбарт шууд бичлээ ✍️");
        }
      }
    },
    [
      announce,
      cleanFillers,
      data.activeTimer,
      onAskBondook,
      onNavigate,
      store,
      today,
    ],
  );

  const toggleMic = useCallback(async () => {
    setError("");
    if (listening) {
      sessionRef.current?.stop();
      setListening(false);
      return;
    }
    const sess = new BrowserVoiceSession(
      {
        onInterim: (t) => setInterim(t),
        onFinal: (seg) => {
          void executeOrDictate(seg);
        },
        onLevel: (rms) => setLevel(rms),
        onStateChange: (on) => setListening(on),
        onError: (msg) => setError(msg),
      },
      lang,
    );
    sessionRef.current = sess;
    await sess.start(lang);
  }, [executeOrDictate, lang, listening]);

  useEffect(() => {
    if (!open && listening) {
      sessionRef.current?.stop();
    }
  }, [open, listening]);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
    },
    [],
  );

  const cycleLang = () => {
    const idx = VOICE_LANGUAGES.findIndex((l) => l.code === lang);
    const next = VOICE_LANGUAGES[(idx + 1) % VOICE_LANGUAGES.length];
    setLang(next.code);
    sessionRef.current?.setLanguage(next.code);
  };

  const saveTranscriptAsNote = async () => {
    if (!transcript.trim()) return;
    const note: StudyNote = {
      ...recordBase(transcript.slice(0, 44) || "Дуу хоолойн бичвэр", null),
      kind: "note",
      date: today,
      body: transcript.trim(),
      tags: ["voice"],
      image: null,
      links: [],
    };
    await store.mutate(saveKnowledge(note), {
      reportError: false,
      reportBusy: false,
    });
    setFeedback("Мэдлэгийн санд тэмдэглэл болгон хадгаллаа! 📚");
  };

  if (!open) return null;

  const currentLangMeta =
    VOICE_LANGUAGES.find((l) => l.code === lang) ?? VOICE_LANGUAGES[0];
  const supported = isBrowserSpeechSupported();

  return (
    <section
      aria-label="Дуу хоолойн удирдлага"
      className="v10-voice-flowbar fixed bottom-20 left-1/2 z-50 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-3xl border border-white/15 bg-[#0e1220]/95 p-3.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
    >
      {/* Top Pill Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleMic()}
            disabled={!supported}
            aria-label={listening ? "Яриа танихыг зогсоох" : "Ярьж эхлэх"}
            className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-bold transition ${
              listening
                ? "bg-red-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.55)]"
                : "text-slate-950 hover:scale-105"
            } disabled:opacity-40`}
            style={!listening ? { background: accent } : undefined}
          >
            {listening ? <MicOff size={19} /> : <Mic size={19} />}
          </button>

          {/* 5-Bar Live Waveform */}
          <div
            className="flex h-8 items-center gap-1 rounded-xl bg-white/5 px-2.5 ring-1 ring-white/10"
            aria-hidden="true"
          >
            {[0.45, 0.8, 1, 0.75, 0.5].map((mult, idx) => {
              const barH = listening
                ? Math.max(4, Math.min(24, 5 + level * 26 * mult))
                : 4;
              return (
                <span
                  key={idx}
                  className="w-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${barH}px`,
                    background: listening ? accent : "rgba(255,255,255,0.28)",
                  }}
                />
              );
            })}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span>Voice FlowBar</span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                MN · EN · JA
              </span>
            </div>
            <p className="truncate text-[11px] text-white/60">
              {listening
                ? interim || "Сонсож байна… Команд эсвэл бичвэр хэлнэ үү"
                : supported
                  ? "Микрофон дараад ярина уу (Alt+V)"
                  : "Энэ хөтөч Web Speech API дэмжихгүй байна"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={cycleLang}
            title="Яриа таних хэл солих"
            className="rounded-xl bg-white/8 px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/12 hover:bg-white/15"
          >
            {currentLangMeta.flag} {currentLangMeta.short}
          </button>
          <button
            type="button"
            onClick={() => setCleanFillers((v) => !v)}
            title="Монгол сул үг шүүх ба Англи/Япон нэр томьёо сэргээх"
            className={`rounded-xl p-2 ring-1 transition ${
              cleanFillers
                ? "bg-amber-400/20 text-amber-300 ring-amber-400/40"
                : "bg-white/5 text-white/50 ring-white/10"
            }`}
          >
            <Wand2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSpeakFeedback((v) => !v)}
            title="Дуут хариу (TTS) асаах/унтраах"
            className={`rounded-xl p-2 ring-1 transition ${
              speakFeedback
                ? "bg-emerald-400/20 text-emerald-300 ring-emerald-400/40"
                : "bg-white/5 text-white/50 ring-white/10"
            }`}
          >
            <Volume2 size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Дуу хоолойн самбар хаах"
            className="rounded-xl bg-white/8 p-2 text-white/70 hover:bg-white/15 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Status / Error Banner */}
      {error && (
        <p
          role="alert"
          className="mt-2.5 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/30"
        >
          {error}
        </p>
      )}
      {feedback && !error && (
        <p
          role="status"
          className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-400/30"
        >
          <Sparkles size={13} /> {feedback}
        </p>
      )}

      {/* Live Transcript Box */}
      {(transcript || interim) && (
        <div className="mt-2.5 rounded-2xl bg-black/40 p-3 ring-1 ring-white/10">
          <p className="text-xs leading-relaxed text-white/90">
            {transcript}
            {interim && (
              <span className="ml-1 italic text-amber-300/80">{interim}</span>
            )}
          </p>
          {transcript && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(transcript);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/15"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Хуулсан" : "Хуулах"}
              </button>
              <button
                type="button"
                onClick={() => void saveTranscriptAsNote()}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/15"
              >
                <FilePlus2 size={12} /> Тэмдэглэл болгох
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = transcript;
                  setTranscript("");
                  onNavigate("assistant");
                  onAskBondook?.(q);
                }}
                className="flex items-center gap-1 rounded-lg bg-amber-400/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/30"
              >
                🐾 Бондоокоос асуух
              </button>
              <button
                type="button"
                onClick={() => setTranscript("")}
                className="ml-auto text-[11px] text-white/45 hover:text-white/80"
              >
                Цэвэрлэх
              </button>
            </div>
          )}
        </div>
      )}

      {/* Voice Command Quick Chips (Click or Speak!) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-white/45">Хэлж болох командууд:</span>
        {[
          { label: "▶ Фокус эхэл", say: "фокус эхэл" },
          { label: "⏸ Түр зогс", say: "түр зогс" },
          { label: "🌧 Бороо асаа", say: "бороо асаа" },
          { label: "🌙 Гүн шөнө", say: "гүн шөнө" },
          { label: "🔇 Дуу зогсоо", say: "дуу зогсоо" },
          { label: "📚 Мэдлэг нээ", say: "мэдлэг нээ" },
        ].map((chip) => (
          <button
            key={chip.say}
            type="button"
            onClick={() => void executeOrDictate(chip.say)}
            className="rounded-full bg-white/6 px-2.5 py-1 font-medium text-white/75 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}
