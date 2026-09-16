"use client";
import { useEffect, useRef, useState } from "react";
import { useClock, useStoreState, useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { clock, timeLabel } from "@/lib/calculations/dates";
import { elapsed } from "@/lib/calculations/timer";
import type { TimerMode, TimerPhase } from "@/types/study";
import { Empty, SubjectSelect } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import {
  readTimerDraft,
  writeTimerDraft,
  clearTimerDraft,
} from "@/lib/persistence/timer-draft";
import { notifyUser } from "@/lib/notifications";

export function TimerWatch() {
  const { data, store, run, navigate } = useStudy(),
    t = data.activeTimer,
    now = useClock(Boolean(t?.running)),
    finishing = useRef(false);
  useEffect(() => {
    if (
      t?.running &&
      t.targetMs !== null &&
      elapsed(t, now) >= t.targetMs &&
      t.status === "active" &&
      !finishing.current
    ) {
      finishing.current = true;
      void run(() => store.mutate(actions.finish())).then((ok) => {
        finishing.current = false;
        if (ok)
          notifyUser(
            t.phase === "focus"
              ? "Хичээл дууслаа. Үр дүнгээ хадгалаарай."
              : "Амралт дууслаа.",
            data.settings,
          );
      });
    }
  }, [t, now, store, run, data.settings]);
  if (!t) return null;
  return (
    <button className="active-timer-chip" onClick={() => navigate("focus")}>
      <span className={t.running ? "live-dot" : ""} />
      <Icon name={t.status === "review" ? "check" : "clock"} size={16} />
      {t.status === "review" ? "Үр дүнгээ хадгалах" : clock(elapsed(t, now))}
      <Icon name="arrow" size={16} />
    </button>
  );
}
export function StudyTimer({ compact = false }: { compact?: boolean }) {
  const { data, store, run, navigate, index } = useStudy(),
    { busy } = useStoreState(),
    t = data.activeTimer,
    now = useClock(Boolean(t?.running));
  const [subjectId, setSubjectId] = useState(
    t?.subjectId ??
      data.subjects.find((s) => !s.deletedAt && !s.archived)?.id ??
      "",
  );
  const [mode, setMode] = useState<TimerMode>(data.settings.defaultTimer),
    [phase, setPhase] = useState<TimerPhase>("focus"),
    [minutes, setMinutes] = useState(data.settings.focusMinutes),
    [note, setNote] = useState(() =>
      t ? readTimerDraft(store.getSnapshot().namespace, t.id, t.note) : "",
    ),
    [complete, setComplete] = useState(true),
    [showNote, setShowNote] = useState(false);
  const tId = t?.id;
  useEffect(() => {
    if (!tId) return;
    const id = setTimeout(() => {
      if (note !== store.getSnapshot().data.activeTimer?.note)
        void run(() => store.mutate(actions.timerNote(note)));
    }, 500);
    return () => clearTimeout(id);
  }, [note, tId, store, run]);
  if (!data.subjects.some((s) => !s.deletedAt))
    return (
      <div className="card">
        <Empty
          title="Эхлээд нэг хичээл нэмье"
          description="Таны анхны жижиг алхам эндээс эхэлнэ."
          action={
            <button
              className="button primary"
              onClick={() => navigate("subjects")}
            >
              Хичээл нэмэх <Icon name="plus" />
            </button>
          }
        />
      </div>
    );
  const ms = t ? elapsed(t, now) : 0,
    remaining =
      t?.targetMs !== null && t?.targetMs !== undefined
        ? Math.max(0, t.targetMs - ms)
        : null;
  const start = async () => {
    if (
      await run(() =>
        store.mutate(
          actions.start(
            subjectId,
            mode,
            phase,
            mode === "pomodoro" ? minutes : null,
          ),
        ),
      )
    ) {
      setNote("");
      navigate("focus");
    }
  };
  return (
    <div className={`timer-layout ${compact ? "timer-compact" : ""}`}>
      <section className="card timer-card">
        <div className="eyebrow">
          <span className="live-dot" /> ӨӨРТӨӨ ЗОРИУЛСАН ЦАГ
        </div>
        <h2 className={t ? "active-subject" : ""}>
          {t
            ? index.subjects.get(t.subjectId)?.name
            : "Нэг жижиг алхам эхлүүлье."}
        </h2>
        {t?.taskId && (
          <p className="timer-task">
            {data.tasks.find((task) => task.id === t.taskId)?.title ??
              (typeof t.extras.taskTitle === "string"
                ? t.extras.taskTitle
                : "Төлөвлөсөн алхам")}
          </p>
        )}
        <p className="muted">
          {t?.status === "review"
            ? "Хийсэн зүйлээ тэмдэглээд, үр дүнгээ хадгалаарай."
            : "Төгс байх шаардлагагүй. Зүгээр л эхэл."}
        </p>
        {!t && (
          <div className="timer-config">
            <SubjectSelect value={subjectId} onChange={setSubjectId} required />
            <div className="segmented" aria-label="Timer горим">
              {(["stopwatch", "pomodoro"] as const).map((m) => (
                <button
                  key={m}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                >
                  {m === "stopwatch" ? "Stopwatch" : "Pomodoro"}
                </button>
              ))}
            </div>
            {mode === "pomodoro" && (
              <>
                <div className="segmented">
                  {(
                    [
                      ["focus", "Төвлөрөх"],
                      ["shortBreak", "Богино амралт"],
                      ["longBreak", "Урт амралт"],
                    ] as const
                  ).map(([p, label]) => (
                    <button
                      key={p}
                      aria-pressed={phase === p}
                      onClick={() => {
                        setPhase(p);
                        setMinutes(
                          p === "focus"
                            ? data.settings.focusMinutes
                            : p === "shortBreak"
                              ? data.settings.shortBreakMinutes
                              : data.settings.longBreakMinutes,
                        );
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="preset-row">
                  {[25, 50, 90].map((m) => (
                    <button
                      key={m}
                      className="button small"
                      onClick={() => {
                        setMinutes(m);
                        setPhase("focus");
                        void run(() =>
                          store.mutate(
                            actions.settings({
                              focusMinutes: m,
                              shortBreakMinutes:
                                m === 25 ? 5 : m === 50 ? 10 : 15,
                            }),
                          ),
                        );
                      }}
                    >
                      {m}/{m === 25 ? 5 : m === 50 ? 10 : 15}
                    </button>
                  ))}
                  <label>
                    Минут
                    <input
                      aria-label="Timer хугацаа минут"
                      type="number"
                      min={1}
                      max={240}
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        )}
        <div
          className="timer-orbit"
          style={
            {
              "--progress": `${t?.targetMs ? (ms / t.targetMs) * 100 : 0}%`,
            } as React.CSSProperties
          }
        >
          <span className="timer-type">
            {t
              ? t.phase === "focus"
                ? "ТӨВЛӨРӨЛ"
                : t.phase === "shortBreak"
                  ? "БОГИНО АМРАЛТ"
                  : "УРТ АМРАЛТ"
              : mode === "pomodoro"
                ? "POMODORO"
                : "STOPWATCH"}
          </span>
          <output className="timer-digits" aria-label="Хугацаа">
            {clock(
              t ? (remaining ?? ms) : mode === "pomodoro" ? minutes * 60000 : 0,
            )}
          </output>
          <span className="timer-status">
            {t?.status === "review"
              ? "Хадгалахад бэлэн"
              : t
                ? t.running
                  ? "Таны хэмнэлээр үргэлжилж байна"
                  : "Түр зогссон"
                : "Бэлэн бол эхэлье"}
          </span>
        </div>
        <div className="button-row center">
          {!t ? (
            <button
              className="button primary large"
              onClick={start}
              disabled={busy || !subjectId}
            >
              <Icon name="play" />
              Start study
            </button>
          ) : t.status === "review" ? (
            t.phase === "focus" ? (
              <button
                className="button primary large"
                disabled={busy || ms < 5000}
                onClick={async () => {
                  if (
                    await run(
                      () => store.mutate(actions.saveTimer(note, complete)),
                      "Өнөөдөр бага байсан ч ахиц. Хичээлээ хадгаллаа.",
                    )
                  ) {
                    clearTimerDraft(store.getSnapshot().namespace, t.id);
                    setNote("");
                    if (t.mode === "pomodoro") {
                      setMode("pomodoro");
                      setPhase("shortBreak");
                      setMinutes(data.settings.shortBreakMinutes);
                    }
                  }
                }}
              >
                <Icon name="check" />
                Save result
              </button>
            ) : (
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  if (await run(() => store.mutate(actions.discard()))) {
                    setPhase("focus");
                    setMinutes(data.settings.focusMinutes);
                  }
                }}
              >
                Амралтыг дуусгах
              </button>
            )
          ) : (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    store.mutate(
                      t.running ? actions.pause() : actions.resume(),
                    ),
                  )
                }
              >
                <Icon name={t.running ? "pause" : "play"} />
                {t.running ? "Pause" : "Resume"}
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => run(() => store.mutate(actions.finish()))}
              >
                <Icon name="stop" />
                Finish
              </button>
            </>
          )}
          {t && (
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => {
                if (confirm("Энэ timer-ийг хадгалахгүйгээр цуцлах уу?"))
                  void run(() => store.mutate(actions.discard()));
              }}
            >
              Цуцлах
            </button>
          )}
        </div>
        {t?.status === "review" && t.phase === "focus" && ms < 5000 && (
          <p className="muted">
            5 секундээс богино хэмжилтийг хадгалахгүй. Дахин эхлүүлэхийн тулд
            цуцална уу.
          </p>
        )}
        {t && (
          <p className="tiny muted">
            Эхэлсэн: {timeLabel(t.sessionStartedAt)}
            {t.startTimeEstimated ? " · ойролцоо" : ""} · Төвлөрсөн: {clock(ms)}
          </p>
        )}
        {compact && t?.phase === "focus" && t.status !== "review" && (
          <button
            className="text-button"
            aria-expanded={showNote}
            onClick={() => setShowNote(!showNote)}
          >
            <Icon name="edit" size={15} />
            {showNote ? "Тэмдэглэл хураах" : "Тэмдэглэл бичих"}
          </button>
        )}
      </section>
      {(!compact || showNote || t?.status === "review") && (
        <aside className="stack">
          <section className="card">
            <div className="eyebrow">СУРАЛЦСАН ЗҮЙЛЭЭ ҮЛДЭЭЕ</div>
            <h2>Өнөөдрийн тэмдэглэл</h2>
            <label className="sr-only" htmlFor="timer-note">
              Юу сурсан бэ?
            </label>
            <textarea
              id="timer-note"
              className="note-input"
              value={note}
              onChange={(e) => {
                const value = e.target.value;
                setNote(value);
                if (t)
                  try {
                    writeTimerDraft(store.getSnapshot().namespace, t.id, value);
                  } catch (error) {
                    store.reportError(error);
                  }
              }}
              placeholder="Юуг ойлгосон бэ? Дараа нь юунаас үргэлжлүүлэх вэ?"
              rows={8}
              disabled={!t}
              maxLength={10000}
            />
            {t?.taskId && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={complete}
                  onChange={(e) => setComplete(e.target.checked)}
                />
                Хадгалаад төлөвлөгөөг биелсэнд тооцох
              </label>
            )}
            <p className="tiny muted">
              {t
                ? "Тэмдэглэл түр хадгалагдана. Save result дарж түүхдээ оруулна."
                : "Timer эхэлсний дараа тэмдэглэл бичээрэй."}
            </p>
          </section>
          {!compact && (
            <section className="quote-card">
              <Icon name="leaf" size={30} />
              <p>
                Тогтмол байдал
                <br />
                жижиг алхмаас эхэлдэг.
              </p>
              <span>НЭГ ӨДӨР. НЭГ АЛХАМ.</span>
            </section>
          )}
        </aside>
      )}
    </div>
  );
}
