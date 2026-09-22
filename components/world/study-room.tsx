"use client";
import { useEffect, useMemo } from "react";
import { useStudy, useClock } from "@/hooks/use-study";
import {
  companionProgress,
  companionState,
  greeting,
} from "@/lib/world/progress";
import { clock, currentStreak, formatTime } from "@/lib/calculations/dates";
import { actions } from "@/lib/persistence/actions";
import { RoomScene } from "./room-scene";
import { StudyTimer } from "@/components/timer/study-timer";
import { ModuleBoundary } from "@/components/ui/module-boundary";
import { DailyKnowledge } from "@/components/dashboard/daily-knowledge";
import { flexibleStreak } from "@/lib/calculations/dates";
import { DailyPlan } from "@/components/dashboard/daily-plan";
import { WeeklyPulse } from "@/components/dashboard/weekly-pulse";
import { ACCESSORIES } from "@/lib/world/config";
import { knowledgeIndex } from "@/lib/knowledge/index";
import { Progress } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
export function StudyRoom({ focus = false }: { focus?: boolean }) {
  const { data, index, today, navigate, run, store } = useStudy(),
    now = useClock(false);
  const state = companionState(data, index, today),
    world = data.settings.world;
  const progress = useMemo(() => companionProgress(data, today), [data, today]);
  const nextUnlock = ACCESSORIES.find((a) => a.level > progress.level);
  const reviewCount = knowledgeIndex(data.knowledge, today).reviewQueue.length;
  const todaySeconds = index.days.get(today)?.seconds ?? 0,
    daily =
      data.goals.dailyMinutes ??
      Math.round((data.goals.weeklyHours * 60) / data.goals.weeklyDays),
    streak = currentStreak(new Set(index.sortedDates), today);
  const recovery = flexibleStreak(
    new Set(index.sortedDates),
    today,
    Math.max(0, Math.min(2, Number(data.settings.extras.graceDays ?? 1))),
  );
  const last = [...index.sessions].sort((a, b) => b.endEpoch - a.endEpoch)[0];
  useEffect(() => {
    if (!focus) return;
    const exit = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        navigate("overview");
    };
    window.addEventListener("keydown", exit);
    return () => window.removeEventListener("keydown", exit);
  }, [focus, navigate]);

  if (focus)
    return (
      <div className="focus-timer-screen" aria-label="Focus mode">
        <div className="focus-timer-brand">тогтмол · FOCUS</div>
        <button
          className="focus-exit-button"
          onClick={() => navigate("overview")}
          aria-label="Focus-оос гарах"
        >
          <Icon name="close" size={18} />
          Гарах
        </button>
        <div className="focus-timer-stage">
          <StudyTimer
            key={`focus:${data.activeTimer?.id ?? "new"}:${store.getSnapshot().namespace}`}
            compact
          />
        </div>
        <p className="focus-hint">Esc · Focus-оос гарах</p>
      </div>
    );
  return (
    <div className={`study-world ${focus ? "focus-world" : ""}`}>
      <div className="world-heading">
        <div>
          <span className="eyebrow">
            {focus ? "ТӨВЛӨРӨХ ЦАГ" : "МИНИЙ ТУХТАЙ ОРОН ЗАЙ"}
          </span>
          <h1>
            {focus
              ? "Яг одоо, нэг алхам."
              : greeting(new Date(now).getHours(), state)}
          </h1>
          {!focus && <p>Бондооктой хамт. Өөрийн хэмнэлээр.</p>}
        </div>
        <div className="button-row">
          {focus ? (
            <button className="button" onClick={() => navigate("overview")}>
              <Icon name="close" /> Focus-оос гарах
            </button>
          ) : (
            <>
              <button className="button" onClick={() => navigate("room")}>
                <Icon name="settings" /> Өрөөгөө өөрчлөх
              </button>
              <button
                className="icon-button bordered"
                aria-label="Focus mode"
                onClick={() => navigate("focus")}
              >
                <Icon name="expand" />
              </button>
            </>
          )}
        </div>
      </div>
      {!focus && (
        <section className="home-primary-cta" aria-label="Өнөөдрийн гол үйлдэл">
          <div>
            <span className="eyebrow">ӨНӨӨДРИЙН ХАМГИЙН ЧУХАЛ АЛХАМ</span>
            <h2>
              {reviewCount
                ? "Өнөөдрийн " + reviewCount + " карт давт"
                : "Шинэ хичээл эхлүүл"}
            </h2>
            <p>
              {reviewCount
                ? "Өмнө сурсан зүйлээ одоо нэг богино давтлагаар бататгаарай."
                : "Өнөөдрийн жижиг алхмаа эхлүүлээд хэмнэлээ бий болгоорой."}
            </p>
          </div>
          <button
            className="button primary large"
            onClick={() => navigate(reviewCount ? "knowledge" : "timer")}
          >
            <Icon name={reviewCount ? "book" : "play"} size={18} />
            {reviewCount ? "Давтлага эхлүүлэх" : "Хичээл эхлүүлэх"}
          </button>
        </section>
      )}
      <section className="home-stat-grid" aria-label="Өнөөдрийн товч мэдээлэл">
        <article className="home-stat-card">
          <span className="home-stat-icon">🔥</span>
          <div><small>DAY STREAK</small><strong>{streak} <em>өдөр</em></strong><p>{streak ? "Хэмнэлээ үргэлжлүүл" : "Өнөөдөр эхэл"}</p></div>
        </article>
        <article className="home-stat-card">
          <span className="home-stat-icon">✦</span>
          <div><small>LEVEL</small><strong>Lv. {progress.level}</strong><p>{progress.intoLevel}/100 XP</p></div>
        </article>
        <article className="home-stat-card">
          <span className="home-stat-icon">XP</span>
          <div><small>XP</small><strong>{progress.xp}</strong><p>Өнөөдөр +{progress.todayXP} XP</p></div>
        </article>
        <article className="home-stat-card home-stat-goal">
          <span className="home-stat-ring" style={{ "--goal": (daily > 0 ? Math.min(100, (todaySeconds / (daily * 60)) * 100) : 0) + "%" } as React.CSSProperties}><b>{daily > 0 ? Math.round(Math.min(100, (todaySeconds / (daily * 60)) * 100)) : 0}%</b></span>
          <div><small>DAILY GOAL</small><strong>{formatTime(todaySeconds)}</strong><p>{daily} мин target</p></div>
        </article>
      </section>
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
                  : state === "welcome"
                    ? "дахин уулзсандаа баяртай"
                    : state === "happy"
                      ? "жижиг ялалтаа тэмдэглэе"
                      : state === "celebrating"
                        ? "таны хэмнэлийг тэмдэглэж байна"
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
        />
      </section>
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
        {!focus && (
          <div>
            <span>{recovery.recoveryDays ? "Тогтмол хэмнэл" : "Дараалал"}</span>
            <strong>
              {recovery.recoveryDays ? recovery.studied : streak}{" "}
              <small>өдөр</small>
              {recovery.recoveryDays > 0 && (
                <small className="recovery-label">
                  {recovery.recoveryDays} амралтын өдөртэй
                </small>
              )}
            </strong>
          </div>
        )}
      </div>
      {!data.activeTimer &&
        last?.mode === "pomodoro" &&
        last.date === today && (
          <div className="break-suggestion">
            <span>Нүдээ амрааж, ус уух завсарлага аваарай.</span>
            <button
              className="button small"
              onClick={() =>
                run(() =>
                  store.mutate(
                    actions.start(
                      last.subjectId,
                      "pomodoro",
                      "shortBreak",
                      data.settings.shortBreakMinutes,
                    ),
                  ),
                )
              }
            >
              {data.settings.shortBreakMinutes} минут амрах
            </button>
          </div>
        )}
      {!focus && (
        <>
          <ModuleBoundary name="Өнөөдрийн мэдлэг">
            <DailyKnowledge />
          </ModuleBoundary>
          <WeeklyPulse />
          <div className="world-bottom">
            <DailyPlan />
            <section className="card world-journal">
              <div className="eyebrow">A LITTLE AT A TIME</div>
              <h2>Өчигдрөөс нэг алхам цааш.</h2>
              <p>Бондоок тантай хамт {progress.xp} XP цуглуулжээ.</p>
              <Progress
                value={progress.intoLevel}
                label="Бондоокийн түвшний ахиц"
              />
              <p className="tiny muted">
                Дараагийн түвшин хүртэл {100 - progress.intoLevel} XP. Өдөрт 60
                хүртэл XP; урт суулт хийх шаардлагагүй.
              </p>
              {nextUnlock && (
                <div className="next-unlock">
                  <Icon name="leaf" size={18} />
                  <span>
                    Дараагийн чимэглэл: <strong>{nextUnlock.name}</strong>
                  </span>
                </div>
              )}
              {last ? (
                <div className="last-reflection">
                  <span className="eyebrow">СҮҮЛЧИЙН ТЭМДЭГЛЭЛ</span>
                  <p>
                    {last.note ||
                      `${index.subjects.get(last.subjectId)?.name ?? "Хичээл"} · ${clock(last.durationSec * 1000)}`}
                  </p>
                </div>
              ) : (
                <p className="muted">
                  Эхний хичээлээ дуусгаад юу сурснаа үлдээгээрэй.
                </p>
              )}
              <button
                className="text-button"
                onClick={() => navigate("assistant")}
              >
                Бондооктой ярилцах <Icon name="arrow" size={16} />
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
