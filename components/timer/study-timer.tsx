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
import { useWakeLock } from "@/hooks/use-wake-lock";
import { enableSound, notifyTimerWarning, notifyUser } from "@/lib/notifications";

export function TimerWatch() {
  const { data, store, run, navigate, setNotice } = useStudy(),
    t = data.activeTimer,
    now = useClock(Boolean(t?.running)),
    finishing = useRef(false),
    warningTriggered = useRef(false);
  const [alert, setAlert] = useState<"warning" | "complete" | null>(null);
  const [warningText, setWarningText] = useState("");
  const wakeStatus = useWakeLock(
    Boolean(t?.running && data.settings.extras.wakeLock),
  );
  useEffect(() => {
    if (!t?.running || t.targetMs === null || t.status !== "active") return;
    const remainingMs = Math.max(0, t.targetMs - elapsed(t, now));
    const raw = data.settings.extras.timerWarningSeconds;
    const warningSeconds =
      raw === 10 || raw === 30 || raw === 60 ? raw : 0;
    const warningMs = warningSeconds * 1000;
    if (
      warningMs > 0 &&
      remainingMs > 0 &&
      remainingMs <= warningMs &&
      !warningTriggered.current
    ) {
      warningTriggered.current = true;
      const label =
        warningSeconds === 60
          ? "1 минут үлдлээ!"
          : `${warningSeconds} секунд үлдлээ!`;
      setWarningText(label);
      setAlert("warning");
      window.setTimeout(() => {
        setAlert((current) => (current === "warning" ? null : current));
      }, 6000);
      void notifyTimerWarning(label, data.settings, `togtmol-timer-warning-${t.id}`);
    }
  }, [t, now, data.settings]);

  useEffect(() => {
    if (!t || t.targetMs === null || t.status !== "active") {
      warningTriggered.current = false;
      return;
    }
    const raw = data.settings.extras.timerWarningSeconds;
    const warningSeconds =
      raw === 10 || raw === 30 || raw === 60 ? raw : 0;
    if (elapsed(t, now) < Math.max(0, t.targetMs - warningSeconds * 1000))
      warningTriggered.current = false;
  }, [t, now, data.settings]);

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
        if (ok) {
          setNotice(
            t.phase === "focus"
              ? "Хичээл дууслаа. Үр дүнгээ хадгалаарай."
              : "Амралт дууслаа.",
          );
          const message =
            t.phase === "focus"
              ? "Хичээл дууслаа. Үр дүнгээ хадгалаарай."
              : "Амралт дууслаа.";
          setAlert("complete");
          void notifyUser(message, data.settings, `togtmol-timer-${t.id}`);
        }
      });
    }
  }, [t, now, store, run, data.settings, setNotice]);
  const closeAlert = () => {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate(0);
    } catch {}
    setAlert(null);
  };

  if (!t) return null;
  return (
    <>
      {alert && (
        <div className={`timer-alert-layer timer-alert-${alert}`} role="alertdialog" aria-modal="true" aria-live="assertive">
          <div className="timer-alert-backdrop" aria-hidden="true" />
          <section className="timer-alert-card">
            <div className="timer-alert-icon" aria-hidden="true">
              {alert === "complete" ? "⏰" : "⚠"}
            </div>
            <p className="timer-alert-kicker">
              {alert === "complete" ? "TIMER ДУУССАН" : "АНХААРУУЛГА"}
            </p>
            <h2>
              {alert === "complete" ? "Хугацаа дууслаа!" : warningText}
            </h2>
            <p>
              {alert === "complete"
                ? "Таны timer зогслоо. Үр дүнгээ хадгалж болно."
                : "Хэдхэн минутын дараа timer дуусна."}
            </p>
            <div className="timer-alert-actions">
              {alert === "complete" ? (
                <button
                  className="button primary large"
                  onClick={() => {
                    closeAlert();
                    navigate("focus");
                  }}
                >
                  Үр дүнгээ харах
                </button>
              ) : (
                <button className="button large" onClick={closeAlert}>
                  Ойлголоо
                </button>
              )}
            </div>
            {alert === "complete" && (
              <button className="text-button timer-alert-dismiss" onClick={closeAlert}>
                Дууны дохиог хаах
              </button>
            )}
          </section>
        </div>
      )}
      <button
    <button
      title={wakeStatus}
      className="active-timer-chip"
      onClick={() => navigate("focus")}
    >
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
    // Prime Web Audio from the user's Start click. Browsers can block
    // programmatic audio unless the AudioContext was activated by a gesture.
    try {
      await enableSound();
    } catch {
      // Timer must still start even when audio is unavailable.
    }
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
