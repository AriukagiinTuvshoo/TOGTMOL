"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Timer,
  Hourglass,
  Clock,
  Infinity as InfinityIcon,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  X,
  SkipForward,
  BookOpen,
  CheckCircle2,
  Keyboard,
  Volume2,
  VolumeX,
  NotebookPen,
  Target,
  Plus,
  Minus,
  Waves,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { useClock, useStoreState, useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { elapsed } from "@/lib/calculations/timer";
import { enableSound } from "@/lib/notifications";
import {
  readTimerDraft,
  writeTimerDraft,
  clearTimerDraft,
} from "@/lib/persistence/timer-draft";
import {
  fmtClock,
  fmtMnDuration,
  focusScore,
  xpForSession,
} from "@/lib/v9/focus";
import { PRESETS, engine } from "@/lib/v9/audio-engine";
import { useSoundEngine } from "./audio-mixer";
import { BondookAvatar } from "./bondook-widget";
import type { Room } from "@/lib/v9/rooms";
import type { TimerMode as CoreTimerMode, TimerPhase } from "@/types/study";

export type V9TimerMode = "pomodoro" | "countdown" | "stopwatch" | "flowtime";

const POMODORO_PRESETS = [
  { label: "25/5", focus: 25, shortBreak: 5, longBreak: 15, desc: "Хөнгөн" },
  { label: "50/10", focus: 50, shortBreak: 10, longBreak: 20, desc: "Гүн" },
  { label: "90/20", focus: 90, shortBreak: 20, longBreak: 30, desc: "Урсгал" },
];

const QUICK_AMBIENT_IDS = [
  "deep-night",
  "rainy-cafe",
  "forest-dawn",
  "deep-space",
  "cabin-fire",
  "library-hush",
  "ocean-breath",
  "sakura-lofi",
];

function RingClock({
  size,
  progress,
  display,
  phase,
  status,
  accent,
  sw = 8,
  glow = true,
}: {
  size: number;
  progress: number;
  display: string;
  phase: TimerPhase;
  status: "idle" | "running" | "paused" | "review";
  accent: string;
  sw?: number;
  glow?: boolean;
}) {
  const R = 92;
  const C = 2 * Math.PI * R;
  const isBreak = phase !== "focus";
  const color = isBreak ? "#4ade80" : accent;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}${status === "running" ? "38" : "1e"}, transparent 65%)`,
            animation:
              status === "running"
                ? "breathe 4s ease-in-out infinite"
                : undefined,
          }}
        />
      )}
      <svg viewBox="0 0 220 220" className="relative h-full w-full -rotate-90">
        <circle
          cx="110"
          cy="110"
          r={R + 7}
          fill="rgba(8,8,24,0.42)"
          stroke="rgba(255,255,255,.06)"
          strokeWidth={1}
        />
        <circle
          cx="110"
          cy="110"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,.09)"
          strokeWidth={sw}
        />
        <circle
          cx="110"
          cy="110"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.max(0, Math.min(1, progress)))}
          style={{
            transition: "stroke-dashoffset .3s linear, stroke .5s",
            filter: `drop-shadow(0 0 10px ${color})`,
          }}
        />
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const big = i % 5 === 0;
          const r1 = R - (big ? 21 : 17);
          const r2 = R - 25;
          return (
            <line
              key={i}
              x1={110 + Math.cos(a) * r1}
              y1={110 + Math.sin(a) * r1}
              x2={110 + Math.cos(a) * r2}
              y2={110 + Math.sin(a) * r2}
              stroke={big ? "rgba(255,255,255,.38)" : "rgba(255,255,255,.14)"}
              strokeWidth={big ? 2 : 1}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <output
          aria-label="Хугацаа"
          className="font-display font-bold tabular-nums leading-none text-white"
          style={{
            fontSize: Math.round(size * 0.2),
            letterSpacing: "-0.03em",
            textShadow: `0 0 ${Math.round(size * 0.14)}px ${color}88`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {display}
        </output>
        <div
          className="mt-2.5 flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-bold tracking-widest uppercase"
          style={{
            background: isBreak ? "rgba(74,222,128,.15)" : `${accent}22`,
            color: isBreak ? "#86efac" : "#e9d5ff",
            border: `1px solid ${isBreak ? "rgba(74,222,128,.4)" : `${accent}55`}`,
          }}
        >
          {status === "running" && (
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="h-2 w-2 rounded-full bg-current" />
            </span>
          )}
          {status === "review"
            ? "ХАДГАЛАХ"
            : isBreak
              ? phase === "longBreak"
                ? "☕ УРТ АМРАЛТ"
                : "☕ АМРАЛТ"
              : status === "running"
                ? "ГҮН ФОКУС"
                : status === "paused"
                  ? "ТҮР ЗОГССОН"
                  : "БЭЛЭН"}
        </div>
      </div>
    </div>
  );
}

export function TimerSystem({
  room,
  todaySeconds,
  dailyGoalMinutes,
  onSessionComplete,
  onDisplayChange,
}: {
  room: Room;
  todaySeconds: number;
  dailyGoalMinutes: number;
  onSessionComplete?: (info: {
    seconds: number;
    score: number;
    xp: number;
    completed: boolean;
  }) => void;
  onDisplayChange?: (
    clockText: string,
    phase: TimerPhase,
    running: boolean,
  ) => void;
}) {
  const { data, store, run, today, index } = useStudy();
  const { busy } = useStoreState();
  const t = data.activeTimer;
  const now = useClock(Boolean(t?.running));
  const soundState = useSoundEngine();
  const accent = room.accent;

  const activeSubjects = useMemo(
    () => data.subjects.filter((s) => !s.deletedAt && !s.archived),
    [data.subjects],
  );
  const openTasks = useMemo(
    () => data.tasks.filter((tk) => !tk.deletedAt && !tk.completed),
    [data.tasks],
  );
  const todayCycles = useMemo(
    () =>
      data.sessions.filter(
        (s) => !s.deletedAt && s.date === today && s.mode === "pomodoro",
      ).length,
    [data.sessions, today],
  );

  const [v9Mode, setV9Mode] = useState<V9TimerMode>(() => {
    const saved = t?.extras?.v9Mode;
    if (
      saved === "pomodoro" ||
      saved === "countdown" ||
      saved === "stopwatch" ||
      saved === "flowtime"
    ) {
      return saved;
    }
    return "pomodoro";
  });
  const [phase, setPhase] = useState<TimerPhase>(t?.phase ?? "focus");
  const [countdownMin, setCountdownMin] = useState(30);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    t?.subjectId ?? "",
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    t?.taskId ?? null,
  );
  const [focusTopic, setFocusTopic] = useState<string>(() =>
    typeof t?.extras?.focusTopic === "string" ? t.extras.focusTopic : "",
  );
  const [interruptions, setInterruptions] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [bigSize, setBigSize] = useState(370);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [completeTaskChoice, setCompleteTaskChoice] = useState(true);
  const tId = t?.id ?? null;
  const [noteState, setNoteState] = useState<{
    id: string | null;
    value: string;
  }>(() => ({
    id: tId,
    value: t ? readTimerDraft(store.getSnapshot().namespace, t.id, t.note) : "",
  }));
  const note =
    noteState.id === tId
      ? noteState.value
      : tId
        ? readTimerDraft(store.getSnapshot().namespace, tId, t?.note ?? "")
        : "";
  const setNote = useCallback(
    (value: string) => setNoteState({ id: tId, value }),
    [tId],
  );

  useEffect(() => {
    if (!tId) return;
    const timer = setTimeout(() => {
      if (note !== store.getSnapshot().data.activeTimer?.note) {
        void store
          .mutate(actions.timerNote(note), {
            reportError: false,
            reportBusy: false,
          })
          .catch(() => {});
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [note, tId, store]);

  useEffect(() => {
    if (!expanded) return;
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const byW = w < 768 ? w * 0.78 : w * 0.36;
      const byH = h < 700 ? h * 0.44 : h * 0.48;
      setBigSize(Math.round(Math.max(250, Math.min(430, byW, byH))));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [expanded]);

  useEffect(() => {
    const onFs = () =>
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const focusMin = data.settings.focusMinutes || 25;
  const shortBreakMin = data.settings.shortBreakMinutes || 5;
  const longBreakMin = data.settings.longBreakMinutes || 15;

  const activePhase: TimerPhase = t ? t.phase : phase;
  const idleMinutes =
    v9Mode === "pomodoro"
      ? phase === "focus"
        ? focusMin
        : phase === "shortBreak"
          ? shortBreakMin
          : longBreakMin
      : v9Mode === "countdown"
        ? countdownMin
        : 0;

  const ms = t ? elapsed(t, now) : 0;
  const remainingMs =
    t && t.targetMs !== null ? Math.max(0, t.targetMs - ms) : null;

  const displaySec = t
    ? remainingMs !== null
      ? Math.ceil(remainingMs / 1000)
      : Math.floor(ms / 1000)
    : v9Mode === "stopwatch" || v9Mode === "flowtime"
      ? 0
      : idleMinutes * 60;

  const progress = t
    ? t.targetMs
      ? Math.min(1, ms / t.targetMs)
      : Math.min(1, ms / (focusMin * 60000))
    : 0;

  const status: "idle" | "running" | "paused" | "review" = !t
    ? "idle"
    : t.status === "review"
      ? "review"
      : t.running
        ? "running"
        : "paused";

  useEffect(() => {
    onDisplayChange?.(fmtClock(displaySec), activePhase, status === "running");
  }, [displaySec, activePhase, status, onDisplayChange]);

  const ensureSubjectForStart = useCallback(async (): Promise<{
    subjectId: string;
    taskId: string | null;
  } | null> => {
    const current = store.getSnapshot().data;
    const validSubjects = current.subjects.filter(
      (s) => !s.deletedAt && !s.archived,
    );

    // If a task is selected, prefer its subjectId
    if (selectedTaskId) {
      const tk = current.tasks.find(
        (item) => item.id === selectedTaskId && !item.deletedAt,
      );
      if (
        tk &&
        current.subjects.some((s) => s.id === tk.subjectId && !s.deletedAt)
      ) {
        return { subjectId: tk.subjectId, taskId: tk.id };
      }
    }

    if (
      selectedSubjectId &&
      validSubjects.some((s) => s.id === selectedSubjectId)
    ) {
      return { subjectId: selectedSubjectId, taskId: null };
    }

    const freeExisting = validSubjects.find(
      (s) => s.name.trim().toLocaleLowerCase() === "чөлөөт",
    );
    if (freeExisting) {
      return { subjectId: freeExisting.id, taskId: null };
    }
    if (validSubjects.length > 0) {
      return { subjectId: validSubjects[0].id, taskId: null };
    }

    // Create default "Чөлөөт" subject seamlessly in StudyStore
    const ok = await run(() =>
      store.mutate(actions.addSubject("Чөлөөт", "#a78bfa")),
    );
    if (!ok) return null;
    const created = store.getSnapshot().data.subjects.find((s) => !s.deletedAt);
    return created ? { subjectId: created.id, taskId: null } : null;
  }, [run, selectedSubjectId, selectedTaskId, store]);

  const startSession = useCallback(async () => {
    try {
      await enableSound();
    } catch {
      /* Browser audio policy should never block starting the timer. */
    }
    const resolved = await ensureSubjectForStart();
    if (!resolved) return;

    const coreMode: CoreTimerMode =
      v9Mode === "pomodoro" || v9Mode === "countdown"
        ? "pomodoro"
        : "stopwatch";
    const startPhase: TimerPhase = coreMode === "pomodoro" ? phase : "focus";
    const mins =
      coreMode === "pomodoro"
        ? v9Mode === "countdown"
          ? countdownMin
          : phase === "focus"
            ? focusMin
            : phase === "shortBreak"
              ? shortBreakMin
              : longBreakMin
        : null;

    const topicText = focusTopic.trim();
    const ok = await run(() =>
      store.mutate((d) => {
        const started = actions.start(
          resolved.subjectId,
          coreMode,
          startPhase,
          mins,
          resolved.taskId,
        )(d);
        if (!started.activeTimer) return started;
        return {
          ...started,
          activeTimer: {
            ...started.activeTimer,
            note: topicText || started.activeTimer.note,
            extras: {
              ...started.activeTimer.extras,
              v9Mode,
              focusTopic: topicText,
            },
          },
        };
      }),
    );
    if (ok) {
      setLastResult(null);
      setInterruptions(0);
      if (topicText) setNote(topicText);
    }
  }, [
    countdownMin,
    ensureSubjectForStart,
    focusMin,
    focusTopic,
    longBreakMin,
    phase,
    run,
    setNote,
    shortBreakMin,
    store,
    v9Mode,
  ]);

  const togglePauseResume = useCallback(async () => {
    if (!t) return;
    const expired =
      t.running && t.targetMs !== null && elapsed(t, now) >= t.targetMs;
    await run(() =>
      store.mutate(
        expired
          ? actions.finish()
          : t.running
            ? actions.pause()
            : actions.resume(),
      ),
    );
  }, [now, run, store, t]);

  const finishSession = useCallback(async () => {
    if (!t) return;
    await run(() => store.mutate(actions.finish()));
  }, [run, store, t]);

  const saveReviewedSession = useCallback(async () => {
    if (!t) return;
    const actualSec = Math.max(1, Math.round(ms / 1000));
    const plannedSec = t.targetMs
      ? Math.round(t.targetMs / 1000)
      : focusMin * 60;
    const score = focusScore({
      plannedSeconds: plannedSec,
      actualSeconds: actualSec,
      completed: t.targetMs ? ms >= t.targetMs : actualSec >= 300,
      interruptions,
      mode: v9Mode,
      hourOfDay: new Date().getHours(),
    });
    const xp = xpForSession(actualSec, score, true);
    const finalNote = note.trim() || focusTopic.trim();

    if (t.phase !== "focus") {
      if (await run(() => store.mutate(actions.discard()))) {
        setPhase("focus");
        setNote("");
      }
      return;
    }

    if (
      await run(
        () => store.mutate(actions.saveTimer(finalNote, completeTaskChoice)),
        "Өнөөдөр бага байсан ч ахиц. Хичээлээ хадгаллаа.",
      )
    ) {
      clearTimerDraft(store.getSnapshot().namespace, t.id);
      engine.chime("complete");
      setLastResult(
        `+${xp} XP · Фокус ${score}/100 · ${fmtMnDuration(actualSec)}`,
      );
      setNote("");
      setFocusTopic("");
      if (v9Mode === "pomodoro") {
        const nextCycleCount = todayCycles + 1;
        setPhase(nextCycleCount % 4 === 0 ? "longBreak" : "shortBreak");
      }
      onSessionComplete?.({
        seconds: actualSec,
        score,
        xp,
        completed: true,
      });
    }
  }, [
    completeTaskChoice,
    focusMin,
    focusTopic,
    interruptions,
    ms,
    note,
    onSessionComplete,
    run,
    setNote,
    store,
    t,
    todayCycles,
    v9Mode,
  ]);

  const discardSession = useCallback(async () => {
    if (!t) {
      setPhase("focus");
      return;
    }
    if (window.confirm("Энэ timer-ийг хадгалахгүйгээр цуцлах уу?")) {
      await run(() => store.mutate(actions.discard()));
      clearTimerDraft(store.getSnapshot().namespace, t.id);
      setNote("");
      setInterruptions(0);
    }
  }, [run, setNote, store, t]);

  const skipPhase = useCallback(async () => {
    if (t) {
      await run(() => store.mutate(actions.discard()));
    }
    setPhase((prev) =>
      prev === "focus"
        ? (todayCycles + 1) % 4 === 0
          ? "longBreak"
          : "shortBreak"
        : "focus",
    );
    engine.chime("tick");
  }, [run, store, t, todayCycles]);

  const addQuickTaskFromInput = useCallback(async () => {
    const clean = focusTopic.trim();
    if (!clean || t) return;
    const resolved = await ensureSubjectForStart();
    if (!resolved) return;
    const ok = await run(() =>
      store.mutate(
        actions.addTask({
          subjectId: resolved.subjectId,
          date: today,
          minutes: focusMin,
          title: clean,
          startTime: null,
        }),
      ),
    );
    if (ok) {
      const newest = store
        .getSnapshot()
        .data.tasks.filter((tk) => !tk.deletedAt)
        .at(-1);
      if (newest) setSelectedTaskId(newest.id);
    }
  }, [ensureSubjectForStart, focusMin, focusTopic, run, store, t, today]);

  const toggleBrowserFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore browser restrictions */
    }
  }, []);

  // Fullscreen overlay keyboard shortcuts (Space is already handled globally by AppShell)
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setExpanded(false);
        return;
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        void discardSession();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void skipPhase();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        void toggleBrowserFullscreen();
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        engine.setMuted(!engine.getSnapshot().muted);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [discardSession, expanded, skipPhase, toggleBrowserFullscreen]);

  const MODES: { id: V9TimerMode; label: string; icon: LucideIcon }[] = [
    { id: "pomodoro", label: "Помодоро", icon: Clock },
    { id: "countdown", label: "Тоолуур", icon: Hourglass },
    { id: "stopwatch", label: "Секундомер", icon: Timer },
    { id: "flowtime", label: "Урсгал", icon: InfinityIcon },
  ];

  const dailyPct = Math.min(
    100,
    Math.round((todaySeconds / Math.max(1, dailyGoalMinutes * 60)) * 100),
  );
  const currentCycleIndex = todayCycles % 4;
  const activeSubject = t
    ? index.subjects.get(t.subjectId)
    : activeSubjects.find((s) => s.id === selectedSubjectId);

  return (
    <>
      <div className="glass rounded-3xl p-4 md:p-5">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
              style={{
                background: `${accent}22`,
                border: `1px solid ${accent}44`,
              }}
            >
              <Timer size={20} style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-[15px] font-bold text-white">
                Цагийн систем
              </h3>
              <p className="truncate text-[11px] text-white/55">
                {v9Mode === "pomodoro"
                  ? `${focusMin}-${shortBreakMin}-${longBreakMin} · ${todayCycles} цикл дууссан`
                  : v9Mode === "flowtime"
                    ? "Урсгал горим · 1/5 амралт тооцно"
                    : v9Mode === "countdown"
                      ? `${countdownMin} мин тоолуур`
                      : "Чөлөөт секундомер"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/70 ring-1 ring-white/10 transition hover:bg-white/15"
              title="Цагийн тохиргоо"
              aria-label="Цагийн тохиргоо"
            >
              <SlidersHorizontal size={15} />
            </button>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="grid h-9 w-9 place-items-center rounded-xl text-white transition hover:scale-105"
              style={{
                background: `${accent}30`,
                border: `1px solid ${accent}55`,
              }}
              title="Бүтэн дэлгэцээр томруулах"
              aria-label="Бүтэн дэлгэцээр томруулах"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>

        {/* Inline Pomodoro Settings Popover */}
        {showSettings && (
          <div className="anim-pop mt-3 rounded-2xl bg-black/40 p-3 ring-1 ring-white/12">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/50">
              <span>Помодоро хэмнэл</span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-white/50 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {POMODORO_PRESETS.map((p) => {
                const isSelected =
                  focusMin === p.focus && shortBreakMin === p.shortBreak;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      void run(() =>
                        store.mutate(
                          actions.settings({
                            focusMinutes: p.focus,
                            shortBreakMinutes: p.shortBreak,
                            longBreakMinutes: p.longBreak,
                          }),
                        ),
                      )
                    }
                    className={`rounded-xl px-2 py-2 text-center ring-1 transition ${
                      isSelected
                        ? "text-white"
                        : "bg-white/5 text-white/65 ring-white/10 hover:bg-white/10"
                    }`}
                    style={
                      isSelected
                        ? {
                            background: `${accent}33`,
                            borderColor: `${accent}66`,
                          }
                        : undefined
                    }
                  >
                    <div className="text-[13px] font-bold">{p.label}</div>
                    <div className="text-[10px] opacity-70">{p.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 Mode Tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={Boolean(t)}
              onClick={() => {
                if (!t) {
                  setV9Mode(m.id);
                  setPhase("focus");
                }
              }}
              className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] font-bold ring-1 transition ${
                v9Mode === m.id
                  ? "text-white"
                  : "bg-white/5 text-white/55 ring-white/10 hover:bg-white/10"
              } ${t ? "opacity-65" : ""}`}
              style={
                v9Mode === m.id
                  ? {
                      background: `${accent}2e`,
                      borderColor: `${accent}55`,
                      boxShadow: `0 0 20px ${accent}2a`,
                    }
                  : undefined
              }
            >
              <m.icon size={15} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Countdown Custom Duration Stepper */}
        {v9Mode === "countdown" && !t && (
          <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl bg-white/5 py-2 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setCountdownMin((m) => Math.max(5, m - 5))}
              className="grid h-7 w-7 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
            >
              <Minus size={13} />
            </button>
            <span className="font-display text-sm font-bold text-white">
              {countdownMin} мин
            </span>
            <button
              type="button"
              onClick={() => setCountdownMin((m) => Math.min(240, m + 5))}
              className="grid h-7 w-7 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
            >
              <Plus size={13} />
            </button>
          </div>
        )}

        {/* Circular Dial — Click to Expand */}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Дарж бүтэн дэлгэцээр томруулах"
          className="mx-auto mt-4 block cursor-zoom-in transition-transform hover:scale-[1.02] active:scale-[.99]"
        >
          <div className="relative mx-auto h-[220px] w-[220px]">
            <RingClock
              size={220}
              progress={progress}
              display={fmtClock(displaySec)}
              phase={activePhase}
              status={status}
              accent={accent}
            />
          </div>
          <div className="mt-2 flex items-center justify-center gap-1 text-[11px] font-semibold text-white/40">
            <ArrowUpRight size={12} /> Дарж бүтэн дэлгэцээр томруулах
          </div>
        </button>

        {/* Focus Task Input ("Юун дээр ажиллах вэ?") */}
        {status !== "review" && (
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl bg-black/35 px-3.5 py-2.5 ring-1 ring-white/10 focus-within:ring-white/25">
              <span className="text-sm" aria-hidden="true">
                🍋
              </span>
              <input
                type="text"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addQuickTaskFromInput();
                  }
                }}
                placeholder="Юун дээр ажиллах вэ?"
                className="w-full bg-transparent text-[12.5px] font-medium text-white outline-none placeholder:text-white/40"
              />
            </div>

            {/* Today's Open Task Chips */}
            {openTasks.length > 0 && !t && (
              <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {openTasks.slice(0, 6).map((tk) => {
                  const selected = selectedTaskId === tk.id;
                  return (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setSelectedTaskId(null);
                        } else {
                          setSelectedTaskId(tk.id);
                          setSelectedSubjectId(tk.subjectId);
                          setFocusTopic(tk.title);
                        }
                      }}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold ring-1 transition ${
                        selected
                          ? "bg-white/20 text-white ring-white/40"
                          : "bg-white/[.05] text-white/70 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span aria-hidden="true">🎯</span>
                      <span className="max-w-[160px] truncate">{tk.title}</span>
                      <span className="text-[10px] text-white/40">0/1</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Subject Pills Row */}
        {!t && (
          <div className="mt-2.5 flex items-center gap-2">
            <BookOpen size={14} className="shrink-0 text-white/45" />
            <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId("");
                  setSelectedTaskId(null);
                }}
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                  !selectedSubjectId
                    ? "bg-white/20 text-white ring-white/35"
                    : "bg-white/5 text-white/55 ring-white/10 hover:bg-white/10"
                }`}
              >
                Чөлөөт
              </button>
              {activeSubjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(s.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ring-1 transition ${
                    selectedSubjectId === s.id
                      ? "bg-white/20 text-white ring-white/35"
                      : "bg-white/5 text-white/65 ring-white/10 hover:bg-white/10"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Review Note & Save Box when finished */}
        {t && t.status === "review" && (
          <div className="anim-pop mt-3 space-y-2 rounded-2xl bg-black/35 p-3 ring-1 ring-white/15">
            <label
              htmlFor="v9-timer-note"
              className="block text-[11px] font-bold text-white/70"
            >
              Юу сурсан бэ?
            </label>
            <textarea
              id="v9-timer-note"
              aria-label="Юу сурсан бэ?"
              rows={2}
              value={note}
              onChange={(e) => {
                const val = e.target.value;
                setNote(val);
                try {
                  writeTimerDraft(store.getSnapshot().namespace, t.id, val);
                } catch (err) {
                  store.reportError(err);
                }
              }}
              placeholder="Хийсэн зүйлээ товч тэмдэглээд хадгалаарай…"
              className="w-full resize-none rounded-xl bg-white/5 px-3 py-2 text-[12px] text-white ring-1 ring-white/10 outline-none placeholder:text-white/35 focus:ring-white/30"
            />
            {t.taskId && (
              <label className="flex items-center gap-2 text-[11px] text-white/75">
                <input
                  type="checkbox"
                  checked={completeTaskChoice}
                  onChange={(e) => setCompleteTaskChoice(e.target.checked)}
                />
                Хадгалаад төлөвлөгөөг биелсэнд тооцох
              </label>
            )}
          </div>
        )}

        {/* Last Session XP Banner */}
        {lastResult && !t && (
          <div className="anim-pop mt-3 flex items-center gap-2 rounded-2xl bg-emerald-400/12 px-3 py-2 text-[12px] font-bold text-emerald-200 ring-1 ring-emerald-400/30">
            <CheckCircle2 size={15} /> {lastResult}
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {!t ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startSession()}
              className="anim-ring flex items-center gap-2 rounded-2xl px-9 py-3.5 font-display text-[15px] font-bold text-white transition hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
                boxShadow: `0 10px 34px ${accent}55`,
              }}
            >
              <Play size={17} fill="currentColor" /> Эхлэх
            </button>
          ) : t.status === "review" ? (
            <>
              <button
                type="button"
                disabled={busy || (t.phase === "focus" && ms < 5000)}
                onClick={() => void saveReviewedSession()}
                className="flex items-center gap-2 rounded-2xl px-6 py-3 font-display text-[14px] font-bold text-white transition hover:scale-105 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
                  boxShadow: `0 8px 28px ${accent}55`,
                }}
              >
                <CheckCircle2 size={16} />
                {t.phase === "focus"
                  ? "Үр дүнгээ хадгалах"
                  : "Амралтыг дуусгах"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void discardSession()}
                className="rounded-2xl bg-white/8 px-4 py-3 text-[13px] font-bold text-white/70 ring-1 ring-white/12 transition hover:bg-white/15"
              >
                Цуцлах
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={t.running ? "Pause" : "Resume"}
                disabled={busy}
                onClick={() => void togglePauseResume()}
                className="flex items-center gap-2 rounded-2xl bg-amber-400/20 px-5 py-3 text-[13px] font-bold text-amber-200 ring-1 ring-amber-400/40 transition hover:scale-105"
              >
                {t.running ? (
                  <>
                    <Pause size={16} /> Түр зогс
                  </>
                ) : (
                  <>
                    <Play size={16} /> Үргэлжлүүл
                  </>
                )}
              </button>
              <button
                type="button"
                aria-label="Finish"
                disabled={busy}
                onClick={() => void finishSession()}
                className="flex items-center gap-2 rounded-2xl bg-emerald-400/20 px-5 py-3 text-[13px] font-bold text-emerald-200 ring-1 ring-emerald-400/40 transition hover:scale-105"
              >
                <Square size={15} /> Дуусгах
              </button>
              <button
                type="button"
                aria-label="Цуцлах"
                disabled={busy}
                onClick={() => void discardSession()}
                className="grid h-[44px] w-[44px] place-items-center rounded-2xl bg-white/8 text-white/65 ring-1 ring-white/10 transition hover:bg-white/15"
                title="Цуцлах"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </div>

        {/* Distraction Counter while active */}
        {t && t.status === "active" && (
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setInterruptions((i) => i + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/60 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <Waves size={13} /> Сатаарал: {interruptions}
            </button>
          </div>
        )}

        {/* Bottom Daily Goal Progress Strip (exact match to image-1.png) */}
        <div className="mt-4 flex items-center gap-2.5 pt-1 text-[11px] text-white/45">
          <Target size={13} className="shrink-0 text-white/40" />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${dailyPct}%`,
                background: `linear-gradient(90deg, ${accent}, #fff)`,
              }}
            />
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-white/55">
            {fmtMnDuration(todaySeconds)} / {dailyGoalMinutes}м
          </span>
        </div>
      </div>

      {/* ══════ FULLSCREEN FOCUS OVERLAY (Exact Match to image-2.png) ══════ */}
      {expanded && (
        <div
          className="fixed inset-0 z-[75] flex flex-col justify-between overflow-y-auto select-none"
          role="dialog"
          aria-modal="true"
          aria-label="Бүтэн дэлгэцийн фокус цаг"
          style={{
            background: `linear-gradient(165deg, ${room.bg[0]}f5, ${room.bg[1]}fa 55%, ${room.bg[2]}f5)`,
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
          }}
        >
          {/* Ambient drifting glow orbs */}
          <div
            className="anim-drift1 pointer-events-none absolute -left-36 top-12 h-[440px] w-[440px] rounded-full blur-[130px]"
            style={{ background: `${accent}30` }}
          />
          <div
            className="anim-drift2 pointer-events-none absolute -right-36 bottom-8 h-[460px] w-[460px] rounded-full blur-[140px]"
            style={{
              background: activePhase !== "focus" ? "#4ade8038" : `${accent}26`,
            }}
          />

          {/* ── TOP BAR ── */}
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-7 md:pt-5">
            {/* Top-Left: Room + Cycle Pill */}
            <div className="flex items-center gap-2 rounded-2xl bg-white/[.07] px-3.5 py-2 text-[12.5px] font-bold text-white ring-1 ring-white/12 backdrop-blur-md">
              <span>{room.emoji}</span>
              <span>{room.nameMn}</span>
              <span className="rounded-lg bg-white/10 px-1.5 py-0.5 text-[11px] text-white/70">
                #{todayCycles + 1}
              </span>
              {activeSubject && (
                <span className="hidden items-center gap-1.5 border-l border-white/15 pl-2 text-[11px] text-white/70 sm:inline-flex">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: activeSubject.color }}
                  />
                  {activeSubject.name}
                </span>
              )}
            </div>

            {/* Top-Center: Phase Switcher + Task Input */}
            <div className="order-3 mx-auto flex w-full max-w-md flex-col items-center gap-2 md:order-2 md:w-auto">
              <div className="inline-flex items-center gap-1 rounded-2xl bg-white/[.07] p-1 ring-1 ring-white/12 backdrop-blur-md">
                {(
                  [
                    ["focus", "Фокус"],
                    ["shortBreak", "Богино амралт"],
                    ["longBreak", "Урт амралт"],
                  ] as [TimerPhase, string][]
                ).map(([p, label]) => {
                  const active = activePhase === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={Boolean(t)}
                      onClick={() => {
                        if (!t) {
                          setV9Mode("pomodoro");
                          setPhase(p);
                        }
                      }}
                      className={`rounded-xl px-3.5 py-1.5 text-[12px] font-bold transition ${
                        active
                          ? "text-white"
                          : "text-white/55 hover:text-white/85"
                      }`}
                      style={
                        active
                          ? {
                              background: `${accent}40`,
                              boxShadow: `inset 0 0 0 1px ${accent}77`,
                            }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex w-full min-w-[280px] items-center gap-2 rounded-2xl bg-black/35 px-3.5 py-2 ring-1 ring-white/10">
                <input
                  type="text"
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder="Юун дээр ажиллах вэ?"
                  className="w-full bg-transparent text-center text-[12px] font-medium text-white/90 outline-none placeholder:text-white/35"
                />
              </div>
            </div>

            {/* Top-Right: 6 Sleek Glass Control Icons */}
            <div className="order-2 flex items-center gap-1.5 md:order-3">
              <button
                type="button"
                onClick={() => {
                  setShowShortcuts((v) => !v);
                  setShowNotesDrawer(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white/75 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Гарын товчлол"
                aria-label="Гарын товчлол"
              >
                <Keyboard size={16} />
              </button>
              <button
                type="button"
                onClick={() => engine.setMuted(!soundState.muted)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white/75 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Дуу нээх/хаах (M)"
                aria-label="Дуу нээх эсвэл хаах"
              >
                {soundState.muted ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNotesDrawer((v) => !v);
                  setShowShortcuts(false);
                }}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white/75 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Тэмдэглэл"
                aria-label="Сессийн тэмдэглэл"
              >
                <NotebookPen size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white/75 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Хэмнэл тохируулах"
                aria-label="Хэмнэл тохируулах"
              >
                <SlidersHorizontal size={16} />
              </button>
              <button
                type="button"
                onClick={() => void toggleBrowserFullscreen()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white/75 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Бүтэн дэлгэц (F)"
                aria-label="Браузер бүтэн дэлгэц"
              >
                {isNativeFullscreen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.07] text-white/80 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Хаах (Esc)"
                aria-label="Том цаг хаах"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Optional Floating Popovers (Shortcuts / Notes) */}
          {showShortcuts && (
            <div className="anim-pop glass-deep absolute right-6 top-16 z-30 w-64 rounded-2xl p-3.5 text-[12px] text-white/80 shadow-2xl">
              <div className="mb-2 font-display text-[13px] font-bold text-white">
                Гарын товчлол ⌨️
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-white/55">Эхлэх / Түр зогсоох</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                    Space
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Шинэчлэх</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                    R
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Үе алгасах</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                    S
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Бүтэн дэлгэц</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                    F
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Дуу хаах</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                    M
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Гарах</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                    Esc
                  </kbd>
                </div>
              </div>
            </div>
          )}

          {showNotesDrawer && (
            <div className="anim-pop glass-deep absolute right-6 top-16 z-30 w-80 rounded-2xl p-3.5 shadow-2xl">
              <div className="mb-1.5 font-display text-[13px] font-bold text-white">
                Сессийн тэмдэглэл 📝
              </div>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Юу сурч, юуг ойлгосноо энд тэмдэглэ…"
                className="w-full resize-none rounded-xl bg-black/35 p-2.5 text-[12px] text-white ring-1 ring-white/12 outline-none placeholder:text-white/35"
              />
            </div>
          )}

          {/* ── CENTER STAGE: HUGE RING CLOCK + DOTS + CIRCULAR CONTROLS ── */}
          <div className="relative z-10 my-auto flex flex-col items-center justify-center px-4 py-3">
            <RingClock
              size={bigSize}
              progress={progress}
              display={fmtClock(displaySec)}
              phase={activePhase}
              status={status}
              accent={accent}
              sw={6.5}
            />

            {/* Cycle Dots ("• • • • урт амралт хүртэл") */}
            <div className="mt-4 flex items-center gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full transition-all"
                  style={{
                    background:
                      i <= currentCycleIndex ? accent : "rgba(255,255,255,.18)",
                    boxShadow:
                      i === currentCycleIndex ? `0 0 10px ${accent}` : "none",
                  }}
                />
              ))}
              <span className="ml-1 text-[11px] font-medium text-white/45">
                урт амралт хүртэл
              </span>
            </div>

            {/* Transport Controls (Reset · Big Circle Play/Pause · Skip / Save) */}
            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                onClick={() => void discardSession()}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/[.08] text-white/70 ring-1 ring-white/12 transition hover:scale-105 hover:bg-white/15"
                title="Шинэчлэх (R)"
                aria-label="Шинэчлэх"
              >
                <RotateCcw size={17} />
              </button>

              {status === "review" ? (
                <button
                  type="button"
                  disabled={busy || (t?.phase === "focus" && ms < 5000)}
                  onClick={() => void saveReviewedSession()}
                  className="flex h-16 items-center gap-2.5 rounded-full px-8 font-display text-[15px] font-bold text-white transition hover:scale-105 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
                    boxShadow: `0 12px 44px ${accent}77`,
                  }}
                >
                  <CheckCircle2 size={20} /> Хадгалах
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    t ? void togglePauseResume() : void startSession()
                  }
                  className="anim-ring grid h-16 w-16 place-items-center rounded-full text-white transition hover:scale-105 active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
                    boxShadow: `0 12px 44px ${accent}77`,
                  }}
                  title="Эхлэх / Түр зогсоох (Space)"
                  aria-label={
                    t?.running
                      ? "Түр зогсоох"
                      : t
                        ? "Үргэлжлүүлэх"
                        : "Фокус эхлүүлэх"
                  }
                >
                  {t?.running ? (
                    <Pause size={24} fill="currentColor" />
                  ) : (
                    <Play size={24} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
              )}

              {t && t.status === "active" ? (
                <button
                  type="button"
                  onClick={() => void finishSession()}
                  className="grid h-11 w-11 place-items-center rounded-full bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/40 transition hover:scale-105"
                  title="Дуусгаж хадгалах"
                  aria-label="Дуусгаж хадгалах"
                >
                  <Square size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void skipPhase()}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/[.08] text-white/70 ring-1 ring-white/12 transition hover:scale-105 hover:bg-white/15"
                  title="Дараагийн үе рүү шилжих (S)"
                  aria-label="Дараагийн үе рүү шилжих"
                >
                  <SkipForward size={17} />
                </button>
              )}
            </div>
          </div>

          {/* ── BOTTOM BAR: QUICK AMBIENT PILLS (LEFT) + BONDOOK & DAILY GOAL (RIGHT) ── */}
          <div className="relative z-10 flex flex-col items-stretch justify-between gap-4 px-4 pb-4 md:flex-row md:items-end md:px-7 md:pb-6">
            {/* Bottom-Left: 2 rows of Ambient Preset Pills */}
            <div className="grid max-w-2xl grid-cols-2 gap-1.5 sm:grid-cols-4">
              {QUICK_AMBIENT_IDS.map((id) => {
                const p = PRESETS.find((x) => x.id === id);
                if (!p) return null;
                const isActive = soundState.activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      isActive ? engine.stopAll() : engine.applyPreset(p.id)
                    }
                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-left text-[11.5px] font-bold ring-1 backdrop-blur-md transition hover:scale-[1.02] ${
                      isActive
                        ? "text-white"
                        : "bg-white/[.06] text-white/75 ring-white/10 hover:bg-white/12"
                    }`}
                    style={
                      isActive
                        ? {
                            background: `${accent}30`,
                            borderColor: `${accent}66`,
                            boxShadow: `0 0 18px ${accent}33`,
                          }
                        : undefined
                    }
                  >
                    <span>{p.emoji}</span>
                    <span className="truncate">{p.nameMn}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom-Right: Bondook Bubble + Daily Goal Progress Pill */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2.5">
                <div className="max-w-[230px] rounded-2xl bg-white/[.07] px-3.5 py-2.5 text-[11.5px] leading-snug text-white/85 ring-1 ring-white/12 backdrop-blur-md">
                  {status === "running"
                    ? "Гүн фокус явагдаж байна — амьсгалаа ажиглаарай ✨"
                    : `${focusMin} минут — зүгээр л эхэл. Би хамт байна! 🐾`}
                </div>
                <BondookAvatar
                  mood={status === "running" ? "focus" : "sleep"}
                  size={54}
                />
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/[.07] px-4 py-2.5 ring-1 ring-white/12 backdrop-blur-md">
                <div className="relative grid h-8 w-8 place-items-center rounded-full bg-white/8 ring-1 ring-white/12">
                  <Target size={15} style={{ color: accent }} />
                </div>
                <div>
                  <div className="text-[9.5px] font-bold uppercase tracking-widest text-white/45">
                    Өдрийн зорилго
                  </div>
                  <div className="font-display text-[13px] font-bold tabular-nums text-white">
                    {fmtMnDuration(todaySeconds)} / {dailyGoalMinutes} мин
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
