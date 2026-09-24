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
import { useI18n } from "@/components/i18n/language-provider";
const SUBJECT_CATEGORIES = [
  {
    id: "it",
    name: "IT / Програмчлал",
    icon: "chart",
    tracks: [
      { id: "software", name: "Програм хангамж хөгжүүлэгч" },
      { id: "web", name: "Web Developer" },
      { id: "data-ai", name: "Data / AI" },
      { id: "cyber", name: "Cybersecurity" },
      { id: "network", name: "Network / Infrastructure" },
    ],
  },
  {
    id: "business",
    name: "Бизнес / Эдийн засаг",
    icon: "target",
    tracks: [
      { id: "business", name: "Бизнесийн удирдлага" },
      { id: "accounting", name: "Нягтлан бодох бүртгэл" },
      { id: "finance", name: "Санхүү / Банк" },
      { id: "marketing", name: "Маркетинг" },
    ],
  },
  {
    id: "language",
    name: "Хэл",
    icon: "book",
    tracks: [
      { id: "japanese", name: "Япон хэл" },
      { id: "english", name: "Англи хэл" },
      { id: "mongolian", name: "Монгол хэл" },
    ],
  },
  {
    id: "science",
    name: "Шинжлэх ухаан",
    icon: "spark",
    tracks: [
      { id: "math", name: "Математик" },
      { id: "physics", name: "Физик" },
      { id: "chemistry", name: "Хими" },
      { id: "biology", name: "Биологи" },
    ],
  },
  {
    id: "social",
    name: "Нийгэм / Хүмүүнлэг",
    icon: "user",
    tracks: [
      { id: "history", name: "Түүх" },
      { id: "geography", name: "Газарзүй" },
      { id: "law", name: "Эрх зүй" },
      { id: "psychology", name: "Сэтгэл судлал" },
    ],
  },
  {
    id: "school10",
    name: "10 жилийн сургууль",
    icon: "calendar",
    tracks: [
      { id: "school-math", name: "Математик" },
      { id: "school-mongolian", name: "Монгол хэл" },
      { id: "school-english", name: "Англи хэл" },
      { id: "school-physics", name: "Физик" },
      { id: "school-chemistry", name: "Хими" },
      { id: "school-biology", name: "Биологи" },
      { id: "school-history", name: "Түүх" },
      { id: "school-geography", name: "Газарзүй" },
    ],
  },
  { id: "other", name: "Бусад", icon: "more", tracks: [] },
] as const;

const SUBJECT_CATEGORY_EN: Record<string, string> = {
  all: "All",
  it: "IT / Programming",
  business: "Business / Economics",
  language: "Languages",
  science: "Science",
  social: "Social Sciences / Humanities",
  school10: "10-year school",
  other: "Other",
};
const SUBJECT_TRACK_EN: Record<string, string> = {
  software: "Software Development",
  web: "Web Development",
  "data-ai": "Data / AI",
  cyber: "Cybersecurity",
  network: "Network / Infrastructure",
  business: "Business Administration",
  accounting: "Accounting",
  finance: "Finance / Banking",
  marketing: "Marketing",
  japanese: "Japanese",
  english: "English",
  mongolian: "Mongolian",
  math: "Mathematics",
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  history: "History",
  geography: "Geography",
  law: "Law",
  psychology: "Psychology",
  "school-math": "Mathematics",
  "school-mongolian": "Mongolian",
  "school-english": "English",
  "school-physics": "Physics",
  "school-chemistry": "Chemistry",
  "school-biology": "Biology",
  "school-history": "History",
  "school-geography": "Geography",
};
const subjectCategoryName = (id: string, name: string, language: "mn" | "en") =>
  language === "en" ? SUBJECT_CATEGORY_EN[id] ?? name : name;
const subjectTrackName = (id: string, name: string, language: "mn" | "en") =>
  language === "en" ? SUBJECT_TRACK_EN[id] ?? name : name;

export function Subjects() {
  const { data, index, today, store, run, navigate } = useStudy(),
    { language } = useI18n(),
    [editing, setEditing] = useState<Subject | "new" | null>(null),
    [selected, setSelected] = useState(""),
    [archived, setArchived] = useState(false),
    [category, setCategory] = useState("all"),
    [track, setTrack] = useState("all");
  const subject = data.subjects.find((s) => s.id === selected && !s.deletedAt),
    list = data.subjects.filter(
      (s) => !s.deletedAt && (archived || !s.archived),
    ),
    categories = [
      { id: "all", name: "Бүгд", icon: "book", tracks: [] },
      ...SUBJECT_CATEGORIES,
    ],
    activeCategory = categories.find((c) => c.id === category) ?? categories[0],
    tracks = activeCategory?.tracks ?? [],
    categorized = list.filter((s) => {
      const matchesCategory =
        category === "all" ||
        (s.extras.subjectCategory ?? "other") === category;
      const matchesTrack =
        track === "all" || (s.extras.subjectTrack ?? "") === track;
      return matchesCategory && matchesTrack;
    });
  if (subject) {
    const all = periodStats(index, "all", today, subject.id),
      week = periodStats(index, 7, today, subject.id),
      month = periodStats(index, 30, today, subject.id);
    return (
      <div className="stack">
        <div className="section-heading">
          <button className="text-button" onClick={() => setSelected("")}>
            ← ${language === "en" ? "All subjects" : "Бүх хичээл"}
          </button>
          <button className="button small" onClick={() => setEditing(subject)}>
            <Icon name="edit" size={16} />
            {language === "en" ? "Edit" : "Засах"}
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
              {subject.archived
                ? language === "en"
                  ? "ARCHIVED SUBJECT"
                  : "АРХИВЛАСАН ХИЧЭЭЛ"
                : language === "en"
                  ? "MY SUBJECT"
                  : "МИНИЙ ХИЧЭЭЛ"}
            </div>
            <h1>{subject.name}</h1>
          </div>
          <button
            className="button primary"
            onClick={async () => {
              if (data.activeTimer) {
                navigate("focus");
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
                navigate("focus");
            }}
          >
            <Icon name="play" />
            {language === "en" ? "Start" : "Эхлэх"}
          </button>
        </section>
        <div className="metrics four">
          <Metric label={language === "en" ? "Total time" : "Нийт хугацаа"} value={formatTime(all.seconds)} />
          <Metric label={language === "en" ? "Study days" : "Суралцсан өдөр"} value={all.studyDays} />
          <Metric label={language === "en" ? "Sessions" : "Нийт хичээл"} value={all.sessionCount} />
          <Metric
            label={language === "en" ? "Average session" : "Нэг хичээлийн дундаж"}
            value={formatTime(all.averageSession)}
          />
        </div>
        <div className="two-columns">
          <section className="card">
            <SectionTitle
              title={language === "en" ? "Last 7 days" : "Сүүлийн 7 өдөр"}
              subtitle={formatTime(week.seconds)}
            />
            <BarChart
              values={week.days.map((d) => d.seconds)}
              labels={week.days.map((d) => d.date.slice(5))}
              label={language === "en" ? "7-day time" : "7 өдрийн хугацаа"}
              color={subject.color}
            />
          </section>
          <section className="card">
            <SectionTitle
              title={language === "en" ? "Last 30 days" : "Сүүлийн 30 өдөр"}
              subtitle={formatTime(month.seconds)}
            />
            <BarChart
              values={month.days.map((d) => d.seconds)}
              labels={month.days.map((d, i) =>
                i % 5 === 0 ? d.date.slice(5) : "",
              )}
              label={language === "en" ? "30-day time" : "30 өдрийн хугацаа"}
              color={subject.color}
            />
          </section>
        </div>
        <StudyCalendar subjectId={subject.id} />
        <section className="card">
          <SectionTitle title={language === "en" ? "Recent sessions" : "Сүүлийн хичээлүүд"} />
          <SessionList sessions={index.bySubject.get(subject.id) ?? []} />
        </section>
        {editing && (
          <SubjectForm
            subject={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
            categories={categories.filter((c) => c.id !== "all")}
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
          {language === "en" ? "Show archived" : "Архивыг харуулах"}
        </label>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Icon name="plus" />
          {language === "en" ? "Add subject" : "Хичээл нэмэх"}
        </button>
      </div>
      <section className="subject-catalog">
        <div className="subject-catalog-head">
          <div>
            <span className="eyebrow">{language === "en" ? "SUBJECT CATALOG" : "ХИЧЭЭЛИЙН СОНГОЛТ"}</span>
            <h1>{language === "en" ? "What do you want to learn?" : "Юу сурах вэ?"}</h1>
            <p>
              {language === "en"
                ? "Choose a direction to see related subjects in one place."
                : "Чиглэлээ сонгоход түүнтэй холбоотой хичээлүүдийг нэг дороос хараарай."}
            </p>
          </div>
          <div className="subject-catalog-count">
            <strong>{categorized.length}</strong>
            <span>{language === "en" ? "subjects" : "хичээл"}</span>
          </div>
        </div>
        <div className="subject-category-grid">
          {categories.map((c) => {
            const count = list.filter(
              (s) => (s.extras.subjectCategory ?? "other") === c.id,
            ).length;
            return (
              <button
                key={c.id}
                type="button"
                className={`subject-category-card ${category === c.id ? "active" : ""}`}
                onClick={() => {
                  setCategory(c.id);
                  setTrack("all");
                }}
              >
                <span className="subject-category-icon">
                  <Icon name={c.icon} size={20} />
                </span>
                <span>
                  <strong>{subjectCategoryName(c.id, c.name, language)}</strong>
                  <small>{count} {language === "en" ? "subjects" : "хичээл"}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            );
          })}
        </div>
        {category !== "all" && tracks.length > 0 && (
          <div className="subject-track-row">
            <button
              type="button"
              className={`subject-track-chip ${track === "all" ? "active" : ""}`}
              onClick={() => setTrack("all")}
            >
              {language === "en" ? "All tracks" : "Бүх чиглэл"}
            </button>
            {tracks.map((t) => {
              const count = list.filter(
                (s) =>
                  (s.extras.subjectCategory ?? "other") === category &&
                  (s.extras.subjectTrack ?? "") === t.id,
              ).length;
              return (
                <button
                  type="button"
                  key={t.id}
                  className={`subject-track-chip ${track === t.id ? "active" : ""}`}
                  onClick={() => setTrack(t.id)}
                >
                  <strong>{subjectTrackName(t.id, t.name, language)}</strong>
                  <small>{count} {language === "en" ? "subjects" : "хичээл"}</small>
                </button>
              );
            })}
          </div>
        )}
        {categorized.length ? (
          <div className="subjects-grid">
            {categorized.map((s) => {
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
                    {sessions.length} {language === "en" ? "sessions" : "хичээл"} ·{" "}
                    {index.subjectDays.get(s.id)?.size ?? 0} {language === "en" ? "days" : "өдөр"}
                  </span>
                  <div className="subject-card-bottom">
                    <strong>{formatTime(stats.seconds)}</strong>
                    <span>{language === "en" ? "last 7 days" : "сүүлийн 7 өдөр"}</span>
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
              title={language === "en" ? "What do you want to learn?" : "Юу сурахыг хүсэж байна вэ?"}
              description={language === "en" ? "Languages, math, code… Add what you want to learn." : "Хэл, математик, код… Өөрийн сонирхлыг энд нэмээрэй."}
              action={
                <button
                  className="button primary"
                  onClick={() => setEditing("new")}
                >
                  {language === "en" ? "Add your first subject" : "Анхны хичээлээ нэмэх"}
                </button>
              }
            />
          </section>
        )}
      </section>
      {editing && (
        <SubjectForm
          subject={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          categories={categories.filter((c) => c.id !== "all")}
          defaultCategory={category === "all" ? "other" : category}
          defaultTrack={track === "all" ? undefined : track}
        />
      )}
    </>
  );
}
function SubjectForm({
  subject: s,
  onClose,
  categories,
  defaultCategory,
  defaultTrack,
}: {
  subject?: Subject;
  onClose: () => void;
  categories: {
    id: string;
    name: string;
    tracks?: readonly { id: string; name: string }[];
  }[];
  defaultCategory?: string;
  defaultTrack?: string;
}) {
  const { data, store, run } = useStudy(),
    { language } = useI18n(),
    [name, setName] = useState(s?.name ?? ""),
    [category, setCategory] = useState(
      String(s?.extras.subjectCategory ?? defaultCategory ?? "other"),
    ),
    [track, setTrack] = useState(
      String(s?.extras.subjectTrack ?? defaultTrack ?? ""),
    ),
    [color, setColor] = useState(
      s?.color ?? PALETTE[data.subjects.length % PALETTE.length],
    ),
    [archived, setArchived] = useState(s?.archived ?? false),
    [busy, setBusy] = useState(false);
  const selectedCategory = categories.find((c) => c.id === category),
    categoryTracks = selectedCategory?.tracks ?? [];
  return (
    <Modal title={s ? (language === "en" ? "Edit subject" : "Хичээлээ засах") : (language === "en" ? "New subject" : "Шинэ хичээл")} onClose={onClose}>
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
                    ? actions.editSubject(s.id, {
                        name,
                        color,
                        archived,
                        extras: {
                          ...s.extras,
                          subjectCategory: category,
                          subjectTrack: track || null,
                        },
                      })
                    : actions.addSubject(name, color, {
                        subjectCategory: category,
                        subjectTrack: track || null,
                      }),
                ),
              language === "en" ? "Subject saved." : "Хичээл хадгалагдлаа.",
            )
          )
            onClose();
          setBusy(false);
        }}
      >
        <label>
          {language === "en" ? "Subject name" : "Хичээлийн нэр"}
          <input
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder={language === "en" ? "Example: Japanese" : "Жишээ: Япон хэл"}
          />
        </label>
        <label>
          {language === "en" ? "Category" : "Ангилал"}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setTrack("");
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {subjectCategoryName(c.id, c.name, language)}
              </option>
            ))}
          </select>
        </label>
        {categoryTracks.length > 0 && (
          <label>
            {language === "en" ? "Track / direction" : "Мэргэжил / чиглэл"}
            <select value={track} onChange={(e) => setTrack(e.target.value)}>
              <option value="">{language === "en" ? "General / other" : "Ерөнхий / бусад"}</option>
              {categoryTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {subjectTrackName(t.id, t.name, language)}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset>
          <legend>{language === "en" ? "Color" : "Өнгө"}</legend>
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
              aria-label={language === "en" ? "Custom color" : "Өөр өнгө"}
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
            {language === "en" ? "Archive (history and statistics stay)" : "Архивлах (түүх, статистик хадгалагдана)"}
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
