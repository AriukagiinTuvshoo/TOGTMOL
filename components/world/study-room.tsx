"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Flame, Sparkles, Zap, Settings2, Maximize2 } from "lucide-react";
import { useStudy, useClock } from "@/hooks/use-study";
import { companionProgress, companionState } from "@/lib/world/progress";
import { clock, currentStreak, formatTime } from "@/lib/calculations/dates";
import { RoomScene } from "./room-scene";
import { StudyTimer } from "@/components/timer/study-timer";
import { ModuleBoundary } from "@/components/ui/module-boundary";
import { DailyKnowledge } from "@/components/dashboard/daily-knowledge";
import { DailyPlan } from "@/components/dashboard/daily-plan";
import { knowledgeIndex } from "@/lib/knowledge/index";
import { Progress } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { resolveV9RoomId, roomById } from "@/lib/v9/rooms";
import { BONDOOK_TIPS, fmtMnDuration } from "@/lib/v9/focus";
import { PRESETS, engine } from "@/lib/v9/audio-engine";
import { TimerSystem } from "@/components/v9/timer-system";
import { AudioMixer, useSoundEngine } from "@/components/v9/audio-mixer";
import { Breathing } from "@/components/v9/breathing";
import { BondookCard, type BondookMood } from "@/components/v9/bondook-widget";
import { CoFocusWidget } from "@/components/v9/cofocus-widget";
import { ExamCountdown } from "@/components/v9/exam-countdown";
import { CozyCollectiblesCard } from "@/components/v9/cozy-shelf";
import { ShareCardModal } from "@/components/v9/share-card-modal";
import { MoodCheckinCard } from "@/components/v9/mood-checkin";
import { CozyOnboardingBanner } from "@/components/v9/onboarding-card";
import {
  getActiveSimpleProfileSnapshot,
  subscribeSimpleProfile,
} from "@/lib/v9/simple-profile";
import type { TimerPhase } from "@/types/study";

export function StudyRoom({
  focus = false,
  onCelebrate,
  onDisplayChange,
}: {
  focus?: boolean;
  onCelebrate?: (xp: number, title: string, desc?: string) => void;
  onDisplayChange?: (
    clockText: string,
    phase: TimerPhase,
    running: boolean,
  ) => void;
}) {
  const { data, index, today, navigate, store } = useStudy();
  useClock(false);
  const soundState = useSoundEngine();

  const [timerSaved, setTimerSaved] = useState(false);
  const [mood, setMood] = useState<BondookMood>("happy");
  const [bondookMsg, setBondookMsg] = useState<string | undefined>(undefined);
  const [tipIdx, setTipIdx] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const activeProfile = useSyncExternalStore(
    subscribeSimpleProfile,
    getActiveSimpleProfileSnapshot,
    () => null,
  );

  const state = companionState(data, index, today);
  const world = data.settings.world;
  const room = roomById(resolveV9RoomId(world));
  const accent = room.accent;

  const progress = useMemo(() => companionProgress(data, today), [data, today]);
  const reviewCount = useMemo(
    () =>
      knowledgeIndex(data.knowledge, today, data.settings).reviewQueue.length,
    [data.knowledge, data.settings, today],
  );
  const openTasksCount = useMemo(
    () => data.tasks.filter((t) => !t.deletedAt && !t.completed).length,
    [data.tasks],
  );

  const todaySeconds = index.days.get(today)?.seconds ?? 0;
  const daily =
    data.goals.dailyMinutes ??
    Math.max(
      60,
      Math.round(
        (data.goals.weeklyHours * 60) / Math.max(1, data.goals.weeklyDays),
      ) * 2,
    );
  const streak = currentStreak(new Set(index.sortedDates), today);
  const last = [...index.sessions].sort((a, b) => b.endEpoch - a.endEpoch)[0];
  const lastReflection = last
    ? last.note ||
      `${index.subjects.get(last.subjectId)?.name ?? "Хичээл"} · ${clock(last.durationSec * 1000)}`
    : null;

  useEffect(() => {
    const id = setInterval(
      () => setTipIdx((i) => (i + 1) % BONDOOK_TIPS.length),
      15000,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!focus) return;
    const exit = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        navigate("overview");
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [focus, navigate]);

  const handleSessionComplete = useCallback(
    (info: {
      seconds: number;
      score: number;
      xp: number;
      completed: boolean;
    }) => {
      setMood("party");
      setBondookMsg(
        `Гайхалтай! ${fmtMnDuration(info.seconds)} гүн ажил — фокус ${info.score}/100. +${info.xp} XP! 🎉`,
      );
      onCelebrate?.(
        info.xp,
        `+${info.xp} XP · Фокус ${info.score}/100`,
        `${fmtMnDuration(info.seconds)} суралцлаа`,
      );
      setTimeout(() => {
        setMood("happy");
        setBondookMsg(undefined);
      }, 9000);
    },
    [onCelebrate],
  );

  const tip = BONDOOK_TIPS[tipIdx];

  if (focus) {
    return (
      <div className="study-world focus-world space-y-4">
        <div className="world-heading flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="eyebrow text-[11px] font-bold tracking-widest text-white/50">
              ТӨВЛӨРӨХ ЦАГ · {room.emoji} {room.nameMn}
            </span>
            <h1 className="font-display text-2xl font-bold text-white md:text-3xl">
              Яг одоо, нэг алхам.
            </h1>
          </div>
          <div className="button-row">
            <button
              className="button glass rounded-2xl px-4 py-2.5 text-[13px] font-bold text-white"
              onClick={() => navigate("overview")}
            >
              <Icon name="close" /> Focus-оос гарах
            </button>
          </div>
        </div>

        <section className="room-stage" aria-label="Study Room">
          <div className="room-art">
            <RoomScene world={world} state={state} />
            <div className="companion-caption">
              <span className="live-dot" />
              <span>
                Бондоок ·{" "}
                {state === "studying"
                  ? "хамт суралцаж байна"
                  : state === "break"
                    ? "цайны завсарлага"
                    : state === "paused"
                      ? "түр амсхийж байна"
                      : "тантай хамт"}
              </span>
              <span className="level-pill">Lv. {progress.level}</span>
            </div>
          </div>
          <StudyTimer
            key={`${data.activeTimer?.id ?? "new"}:${store.getSnapshot().namespace}`}
            compact
            recentlySaved={timerSaved}
            onSessionSaved={() => setTimerSaved(true)}
            onSessionStarted={() => setTimerSaved(false)}
          />
        </section>

        {/* Quick Ambient Bar in Focus View */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.slice(0, 8).map((p) => {
            const isActive = soundState.activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  isActive ? engine.stopAll() : engine.applyPreset(p.id)
                }
                className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-[11.5px] font-bold ring-1 transition ${
                  isActive
                    ? "text-white"
                    : "bg-white/[.06] text-white/75 ring-white/10 hover:bg-white/12"
                }`}
                style={
                  isActive
                    ? {
                        background: `${accent}30`,
                        borderColor: `${accent}66`,
                      }
                    : undefined
                }
              >
                <span>{p.emoji}</span>
                <span>{p.nameMn}</span>
              </button>
            );
          })}
        </div>

        <div className="daily-strip">
          <div>
            <span>Өнөөдөр</span>
            <strong>
              {formatTime(todaySeconds)} <small>/ {daily}м</small>
            </strong>
          </div>
          <div className="daily-progress">
            <Progress
              value={(todaySeconds / (daily * 60)) * 100}
              label="Өнөөдрийн суралцах зорилго"
            />
            <span>
              {todaySeconds >= daily * 60
                ? "Өнөөдрийн зорилгодоо хүрлээ. Амралтаа ч бас бодоорой."
                : "Бага багаар, өөрийн хэмнэлээр."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v9-overview space-y-5">
      {/* ── 30-Second Cozy Onboarding for New Learners ── */}
      <CozyOnboardingBanner />
      <MoodCheckinCard
        onSelectBondookMood={setMood}
        onBondookMessage={setBondookMsg}
      />

      {/* ── Hero Greeting (Exact Match to image-1.png + Cute Profile Greeting) ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold leading-tight text-white md:text-[28px]">
            {activeProfile
              ? `${activeProfile.avatar} Сайн уу, ${activeProfile.name}! ✨`
              : `${room.greeting.split(".")[0]}.`}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/60 md:text-[13px]">
            <Sparkles size={13} style={{ color: accent }} />
            {room.tip}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("room")}
            className="flex items-center gap-1.5 rounded-xl bg-white/[.06] px-3 py-2 text-[11.5px] font-bold text-white/70 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
          >
            <Settings2 size={13} /> Өрөөгөө өөрчлөх
          </button>
          <button
            type="button"
            aria-label="Focus mode"
            onClick={() => navigate("focus")}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.06] text-white/75 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white"
            title="Төвлөрөх горим"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* ── 3-Column Bento Grid (Exact Match to image-1.png) ── */}
      <div className="grid gap-3.5 lg:grid-cols-12">
        {/* Column 1: Timer System + Bondook */}
        <div className="space-y-3.5 lg:col-span-5">
          <TimerSystem
            room={room}
            todaySeconds={todaySeconds}
            dailyGoalMinutes={daily}
            onSessionComplete={handleSessionComplete}
            onDisplayChange={onDisplayChange}
          />
          <BondookCard
            mood={data.activeTimer?.running ? "focus" : mood}
            message={bondookMsg}
            lastReflection={lastReflection}
            level={progress.level}
            onMood={setMood}
            onOpenChat={() => navigate("assistant")}
          />
        </div>

        {/* Column 2: 13-Channel Audio System */}
        <div className="space-y-3.5 lg:col-span-4">
          <AudioMixer accent={accent} />
        </div>

        {/* Column 3: Today + Breathing + Focus Tip */}
        <div className="space-y-3.5 lg:col-span-3">
          {/* ӨНӨӨДӨР Card */}
          <div className="glass rounded-3xl p-4 md:p-5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/45">
              Өнөөдөр
            </div>
            <div className="mt-1 font-display text-[30px] font-bold leading-tight text-white">
              {fmtMnDuration(todaySeconds)}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11.5px] text-white/60">
              <span className="flex items-center gap-1">
                <Flame size={13} className="shrink-0 text-orange-400" />
                <span>{streak} өдрийн цуврал</span>
              </span>
              <span>{reviewCount} карт хүлээгдэж байна</span>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => navigate("knowledge")}
                className="rounded-2xl bg-white/8 py-2.5 text-[12px] font-bold text-white/85 ring-1 ring-white/10 transition hover:bg-white/14"
              >
                🃏 Карт давтах
              </button>
              <button
                type="button"
                onClick={() => navigate("goals")}
                className="rounded-2xl bg-white/8 py-2.5 text-[12px] font-bold text-white/85 ring-1 ring-white/10 transition hover:bg-white/14"
              >
                🎯 {openTasksCount} даалгавар
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="col-span-2 rounded-2xl bg-indigo-500/20 py-2 text-[12px] font-bold text-indigo-100 ring-1 ring-indigo-400/30 transition hover:bg-indigo-500/30"
              >
                📸 7 хоногийн карт хуваалцах
              </button>
            </div>
          </div>

          {/* Амьсгалын дасгал Card */}
          <Breathing
            accent={accent}
            onDone={(c) =>
              onCelebrate?.(
                c * 2,
                `Амьсгал +${c * 2} XP`,
                "Төвлөрөл сэргэлээ ✨",
              )
            }
          />

          {/* ФОКУС ЗӨВЛӨГӨӨ Card */}
          <div className="glass rounded-3xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/45">
              <Zap size={12} style={{ color: accent }} /> Фокус зөвлөгөө
            </div>
            <div className="mt-1.5 text-[13px] font-bold text-white">
              {tip.title}
            </div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-white/60">
              {tip.body}
            </div>
          </div>
        </div>
      </div>

      {/* ── Below-the-fold Core Continuity: Daily Plan & Daily Knowledge ── */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <DailyPlan />
        <ModuleBoundary name="Өнөөдрийн мэдлэг">
          <DailyKnowledge />
        </ModuleBoundary>
      </div>

      {/* ── Co-Focus Room, Exam Countdown & Cozy Living Shelf ── */}
      <div className="grid gap-3.5 lg:grid-cols-3">
        <CoFocusWidget />
        <ExamCountdown compact />
        <CozyCollectiblesCard />
      </div>

      {shareOpen && <ShareCardModal onClose={() => setShareOpen(false)} />}
    </div>
  );
}
