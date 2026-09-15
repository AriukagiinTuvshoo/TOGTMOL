"use client";
import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { PALETTE } from "@/lib/constants";
import { formatTime } from "@/lib/calculations/dates";
import { periodStats } from "@/lib/calculations/analytics";
import type { Subject } from "@/types/study";
import { Empty, Metric, Modal, SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { SessionList } from "@/components/ui/session-list";
import { StudyCalendar } from "@/components/calendar/study-calendar";
import { BarChart } from "@/components/statistics/charts";
export function Subjects() {
  const { data, index, today, store, run, navigate } = useStudy(),
    [editing, setEditing] = useState<Subject | "new" | null>(null),
    [selected, setSelected] = useState(""),
    [archived, setArchived] = useState(false);
  const subject = data.subjects.find((s) => s.id === selected && !s.deletedAt),
    list = data.subjects.filter(
      (s) => !s.deletedAt && (archived || !s.archived),
    );
  if (subject) {
    const all = periodStats(index, "all", today, subject.id),
      week = periodStats(index, 7, today, subject.id),
      month = periodStats(index, 30, today, subject.id);
    return (
      <div className="stack">
        <div className="section-heading">
          <button className="text-button" onClick={() => setSelected("")}>
            ← Бүх хичээл
          </button>
          <button className="button small" onClick={() => setEditing(subject)}>
            <Icon name="edit" size={16} />
            Засах
          </button>
        </div>
        <section
          className="subject-hero"
          style={{ "--subject": subject.color } as React.CSSProperties}
        >
          <span className="subject-square">
            <Icon name={subject.icon} size={28} />
          </span>
          <div>
            <div className="eyebrow">
              {subject.archived ? "АРХИВЛАСАН ХИЧЭЭЛ" : "МИНИЙ ХИЧЭЭЛ"}
            </div>
            <h1>{subject.name}</h1>
          </div>
          <button
            className="button primary"
            onClick={async () => {
              if (data.activeTimer) {
                navigate("timer");
                return;
              }
              if (
                await run(() =>
                  store.mutate(
                    actions.start(
                      subject.id,
                      data.settings.defaultTimer,
                      "focus",
                      data.settings.focusMinutes,
                    ),
                  ),
                )
              )
                navigate("timer");
            }}
          >
            <Icon name="play" />
            Эхлэх
          </button>
        </section>
        <div className="metrics four">
          <Metric label="Нийт хугацаа" value={formatTime(all.seconds)} />
          <Metric label="Суралцсан өдөр" value={all.studyDays} />
          <Metric label="Нийт хичээл" value={all.sessionCount} />
          <Metric
            label="Нэг хичээлийн дундаж"
            value={formatTime(all.averageSession)}
          />
        </div>
        <div className="two-columns">
          <section className="card">
            <SectionTitle
              title="Сүүлийн 7 өдөр"
              subtitle={formatTime(week.seconds)}
            />
            <BarChart
              values={week.days.map((d) => d.seconds)}
              labels={week.days.map((d) => d.date.slice(5))}
              label="7 өдрийн хугацаа"
              color={subject.color}
            />
          </section>
          <section className="card">
            <SectionTitle
              title="Сүүлийн 30 өдөр"
              subtitle={formatTime(month.seconds)}
            />
            <BarChart
              values={month.days.map((d) => d.seconds)}
              labels={month.days.map((d, i) =>
                i % 5 === 0 ? d.date.slice(5) : "",
              )}
              label="30 өдрийн хугацаа"
              color={subject.color}
            />
          </section>
        </div>
        <StudyCalendar subjectId={subject.id} />
        <section className="card">
          <SectionTitle title="Сүүлийн хичээлүүд" />
          <SessionList sessions={index.bySubject.get(subject.id) ?? []} />
        </section>
        {editing && (
          <SubjectForm
            subject={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </div>
    );
  }
  return (
    <>
      <div className="section-heading">
        <label className="check-label">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Архивыг харуулах
        </label>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Icon name="plus" />
          Хичээл нэмэх
        </button>
      </div>
      {list.length ? (
        <div className="subjects-grid">
          {list.map((s) => {
            const stats = periodStats(index, 7, today, s.id),
              sessions = index.bySubject.get(s.id) ?? [];
            return (
              <button
                key={s.id}
                className="card subject-card"
                onClick={() => setSelected(s.id)}
              >
                <div className="subject-card-top">
                  <span
                    className="subject-square"
                    style={{ background: s.color }}
                  >
                    <Icon name={s.icon} size={24} />
                  </span>
                  <Icon name="arrow" size={18} />
                </div>
                <h2>{s.name}</h2>
                <span className="muted">
                  {s.archived ? "Архив · " : ""}
                  {sessions.length} хичээл ·{" "}
                  {index.subjectDays.get(s.id)?.size ?? 0} өдөр
                </span>
                <div className="subject-card-bottom">
                  <strong>{formatTime(stats.seconds)}</strong>
                  <span>сүүлийн 7 өдөр</span>
                </div>
                <div className="mini-week">
                  {stats.days.map((d) => (
                    <span
                      key={d.date}
                      style={{
                        background: d.subjects.size
                          ? s.color
                          : "var(--surface-muted)",
                      }}
                      title={`${d.date}: ${formatTime(d.seconds)}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty
            title="Юу сурахыг хүсэж байна вэ?"
            description="Хэл, математик, код… Өөрийн сонирхлыг энд нэмээрэй."
            action={
              <button
                className="button primary"
                onClick={() => setEditing("new")}
              >
                Анхны хичээлээ нэмэх
              </button>
            }
          />
        </section>
      )}
      {editing && (
        <SubjectForm
          subject={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function SubjectForm({
  subject: s,
  onClose,
}: {
  subject?: Subject;
  onClose: () => void;
}) {
  const { data, store, run } = useStudy(),
    [name, setName] = useState(s?.name ?? ""),
    [color, setColor] = useState(
      s?.color ?? PALETTE[data.subjects.length % PALETTE.length],
    ),
    [archived, setArchived] = useState(s?.archived ?? false),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={s ? "Хичээлээ засах" : "Шинэ хичээл"} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (
            await run(
              () =>
                store.mutate(
                  s
                    ? actions.editSubject(s.id, { name, color, archived })
                    : actions.addSubject(name, color),
                ),
              "Хичээл хадгалагдлаа.",
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <label>
          Хичээлийн нэр
          <input
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="Жишээ: Япон хэл"
          />
        </label>
        <fieldset>
          <legend>Өнгө</legend>
          <div className="palette">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                style={{ background: c }}
                aria-label={`Өнгө ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              >
                {color === c ? <Icon name="check" /> : null}
              </button>
            ))}
            <input
              type="color"
              aria-label="Өөр өнгө"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </fieldset>
        {s && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Архивлах (түүх, статистик хадгалагдана)
          </label>
        )}
        <div className="button-row">
          {s && (
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={async () => {
                const count = data.sessions.filter(
                  (x) => x.subjectId === s.id && !x.deletedAt,
                ).length;
                if (
                  confirm(
                    `“${s.name}” болон холбоотой ${count} хичээл, төлөвлөгөөг хогийн сав руу шилжүүлэх үү? Тохиргооноос сэргээж болно.`,
                  )
                )
                  if (
                    await run(
                      () => store.mutate(actions.deleteSubject(s.id)),
                      "Хогийн сав руу шилжүүллээ.",
                    )
                  )
                    onClose();
              }}
            >
              <Icon name="trash" size={16} />
              Устгах
            </button>
          )}
          <button className="button primary" disabled={busy}>
            Хадгалах
          </button>
        </div>
      </form>
    </Modal>
  );
}
