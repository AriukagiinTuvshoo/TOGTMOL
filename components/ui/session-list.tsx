"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import {
  clock,
  dateLabel,
  formatTime,
  timeLabel,
} from "@/lib/calculations/dates";
import type { StudySession } from "@/types/study";
import { Empty, Modal } from "./common";
import { Icon } from "./icon";
export function SessionList({
  sessions,
  limit = 6,
}: {
  sessions: StudySession[];
  limit?: number;
}) {
  const { index } = useStudy(),
    [selected, setSelected] = useState<StudySession | null>(null),
    [count, setCount] = useState(limit);
  if (!sessions.length)
    return (
      <Empty
        title="Эхний хичээлээ эхлүүлье"
        description="Таны суралцсан хугацаа, тэмдэглэл энд хадгалагдана."
      />
    );
  return (
    <>
      <div className="session-list">
        {sessions.slice(0, count).map((s) => (
          <button
            className="session-row"
            key={s.id}
            onClick={() => setSelected(s)}
          >
            <span
              className="subject-dot"
              style={{ background: index.subjects.get(s.subjectId)?.color }}
            />
            <span className="session-name">
              <strong>
                {index.subjects.get(s.subjectId)?.name ?? "Өмнөх хичээл"}
              </strong>
              <span>
                {s.note || "Тэмдэглэлгүй"} · {dateLabel(s.date)}
              </span>
            </span>
            <span className="session-time">
              {formatTime(s.durationSec)}
              <small>
                {s.startTimeEstimated
                  ? "Ойролцоо цаг"
                  : timeLabel(s.startEpoch)}
              </small>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        ))}
      </div>
      {sessions.length > count && (
        <button
          className="button ghost full"
          onClick={() => setCount((c) => c + 25)}
        >
          Дараагийн {Math.min(25, sessions.length - count)} хичээл
        </button>
      )}
      {selected && (
        <SessionEditor
          key={selected.id}
          session={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function SessionEditor({
  session: s,
  onClose,
}: {
  session: StudySession;
  onClose: () => void;
}) {
  const { store, run, index, today } = useStudy(),
    [note, setNote] = useState(s.note),
    [date, setDate] = useState(s.date),
    [seconds, setSeconds] = useState(String(s.durationSec)),
    [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (
      await run(
        () =>
          store.mutate(
            actions.editSession(
              s.id,
              { note, date, durationSec: Number(seconds) },
              s.updatedAt,
            ),
          ),
        "Хичээлийг шинэчиллээ.",
      )
    )
      onClose();
    setBusy(false);
  };
  return (
    <Modal
      title={index.subjects.get(s.subjectId)?.name ?? "Хичээл"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <div className="result-number">{clock(s.durationSec * 1000)}</div>
        <p className="muted">
          {timeLabel(s.startEpoch)}–{timeLabel(s.endEpoch)} ·{" "}
          {s.mode === "pomodoro" ? "Pomodoro" : "Stopwatch"}
          {s.startTimeEstimated ? " · Эхлэх цаг ойролцоо" : ""}
          {s.manuallyEdited ? " · Хугацааг зассан" : ""}
        </p>
        <div className="form-grid">
          <label>
            Өдөр
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Хугацаа (секунд)
            <input
              type="number"
              min="5"
              max={86400 * 366}
              step="1"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Юу сурсан бэ?
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={10000}
          />
        </label>
        <div className="button-row">
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={async () => {
              if (confirm("Энэ хичээлийг хогийн сав руу шилжүүлэх үү?"))
                if (
                  await run(
                    () => store.mutate(actions.deleteSession(s.id)),
                    "Хогийн сав руу шилжүүллээ.",
                  )
                )
                  onClose();
            }}
          >
            <Icon name="trash" />
            Устгах
          </button>
          <button className="button primary" disabled={busy}>
            Хадгалах
          </button>
        </div>
      </form>
    </Modal>
  );
}
