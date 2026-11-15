"use client";

import { useMemo } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { useStudy } from "@/hooks/use-study";
import { goalDetails } from "@/lib/world/milestones";
import { resolveV9RoomId, roomById } from "@/lib/v9/rooms";

export function GoalsV9Strip() {
  const { data, today, index } = useStudy();
  const room = roomById(resolveV9RoomId(data.settings.world));
  const accent = room.accent;

  const exams = useMemo(() => {
    const todayEpoch = new Date(`${today}T00:00:00`).getTime();
    return data.studyGoals
      .filter((g) => !g.deletedAt && g.endsOn)
      .map((g) => {
        const endEpoch = new Date(`${g.endsOn}T00:00:00`).getTime();
        const days = Math.ceil((endEpoch - todayEpoch) / 86400000);
        const sub = index.subjects.get(g.subjectId);
        return { ...g, days, sub };
      })
      .filter((g) => Number.isFinite(g.days) && g.days >= -30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [data.studyGoals, index.subjects, today]);

  const autoPlan = useMemo(() => {
    const openTasks = data.tasks
      .filter((t) => !t.deletedAt && !t.completed)
      .slice(0, 3)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        minutes: t.minutes || 25,
        color: index.subjects.get(t.subjectId)?.color ?? accent,
      }));

    const goalSteps = data.studyGoals
      .filter((g) => !g.deletedAt)
      .flatMap((g) => {
        const details = goalDetails(g);
        const nextMilestone = details.milestones[0];
        const perDay = Math.max(15, Math.round(g.weeklyMinutes / 5));
        return [
          {
            id: `goal-${g.id}`,
            title: nextMilestone
              ? `${g.title} → ${nextMilestone.title}`
              : g.title,
            minutes: perDay,
            color: index.subjects.get(g.subjectId)?.color ?? accent,
          },
        ];
      })
      .slice(0, Math.max(0, 4 - openTasks.length));

    return [...openTasks, ...goalSteps];
  }, [accent, data.studyGoals, data.tasks, index.subjects]);

  const planMinutes = autoPlan.reduce((sum, item) => sum + item.minutes, 0);

  if (exams.length === 0 && autoPlan.length === 0) return null;

  return (
    <div className="space-y-3">
      {exams.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {exams.map((g) => {
            const critical = g.days <= 7;
            const urgent = g.days > 7 && g.days <= 14;
            return (
              <div
                key={g.id}
                className="glass overflow-hidden rounded-2xl p-3.5 ring-1"
                style={{
                  background: critical
                    ? "rgba(239,68,68,.14)"
                    : urgent
                      ? "rgba(251,146,60,.12)"
                      : "rgba(255,255,255,.05)",
                  borderColor: critical
                    ? "rgba(239,68,68,.4)"
                    : urgent
                      ? "rgba(251,146,60,.4)"
                      : "rgba(255,255,255,.12)",
                }}
              >
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-display text-[26px] font-bold leading-none tabular-nums"
                    style={{
                      color: critical ? "#fca5a5" : urgent ? "#fdba74" : accent,
                    }}
                  >
                    {Math.max(0, g.days)}
                  </span>
                  <span className="text-[11px] font-bold text-white/60">
                    хоног үлдлээ
                  </span>
                </div>
                <div className="mt-1 truncate text-[12.5px] font-bold text-white">
                  {g.title}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-white/50">
                  {g.sub && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: g.sub.color }}
                    />
                  )}
                  <span>{g.days <= 0 ? "Өнөөдөр!" : g.endsOn}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {autoPlan.length > 0 && (
        <div className="glass rounded-3xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/55">
              <CalendarClock size={13} style={{ color: accent }} /> Өнөөдрийн
              авто-төлөвлөгөө
            </span>
            <span
              className="flex items-center gap-1 text-[11.5px] font-bold"
              style={{ color: accent }}
            >
              <Sparkles size={12} /> ~{planMinutes} мин
            </span>
          </div>
          <div className="space-y-1.5">
            {autoPlan.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/8"
              >
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                  style={{ background: p.color }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-[12.5px] font-semibold text-white/90">
                  {p.title}
                </span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/45">
                  {p.minutes}м
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
