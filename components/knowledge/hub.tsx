"use client";
import { StoredImage } from "@/components/ui/stored-image";
import { useDeferredValue, useMemo, useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { Empty, Modal, SubjectSelect } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { AnimatedBuddy } from "@/components/ui/animated-buddy";
import { ModuleBoundary } from "@/components/ui/module-boundary";
import { KnowledgeEditor, type EditableKind } from "./editor";
import { CardReview, QuizSession } from "./review";
import { CardGenerator } from "./generator";
import {
  knowledgeIndex,
  searchableData,
  searchResults,
} from "@/lib/knowledge/index";
import { removeKnowledge } from "@/lib/knowledge/actions";
import { formatTime } from "@/lib/calculations/dates";
import { MarkdownView } from "./markdown-view";
import { QuizGenerator } from "./quiz-generator";

import type { KnowledgeRecord, StudyQuiz } from "@/types/knowledge";
import type { KnowledgeView } from "@/types/study";
const labels: Record<string, string> = {
  note: "Тэмдэглэл",
  deck: "Картын багц",
  card: "Карт",
  review: "Давтлага",
  quiz: "Сорил",
  attempt: "Сорилын түүх",
  link: "Холбоос",
  session: "Хэмжилт",
};
const tabs: [KnowledgeView, string][] = [
  ["all", "Бүгд"],
  ["note", "Тэмдэглэл"],
  ["image", "Зураг"],
  ["deck", "Карт"],
  ["quiz", "Сорил"],
  ["link", "Холбоос"],
  ["session", "Хичээлийн түүх"],
  ["trash", "Хогийн сав"],
];
export function KnowledgeHub() {
  const { data, store, run, today, selectedRecord, navigate } = useStudy(),
    { busy } = useStoreState();
  const [tab, setTab] = useState<KnowledgeView>("all"),
    [query, setQuery] = useState(""),
    [subject, setSubject] = useState(""),
    [tag, setTag] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [limit, setLimit] = useState(36),
    [showFilters, setShowFilters] = useState(false);
  const [editor, setEditor] = useState<{
      kind: EditableKind;
      record?: KnowledgeRecord;
      deckId?: string;
    } | null>(null),
    [review, setReview] = useState<string | null>(null),
    [quiz, setQuiz] = useState<StudyQuiz | null>(null),
    [generator, setGenerator] = useState(false),
    [quizGenerator, setQuizGenerator] = useState(false);
  const [selected, setSelected] = useState<string | null>(selectedRecord);
  const [cardLimit, setCardLimit] = useState(100);
  const index = useMemo(
    () => knowledgeIndex(data.knowledge, today),
    [data.knowledge, today],
  );
  const deferred = useDeferredValue(query),
    search = useMemo(() => searchableData(data), [data]);
  const matches = useMemo(
    () =>
      new Set(
        searchResults(
          search,
          deferred,
          { subjectId: subject, tag, from, to },
          Infinity,
        ).map((r) => r.id),
      ),
    [search, deferred, subject, tag, from, to],
  );
  const items = data.knowledge
    .filter((r) =>
      tab === "trash"
        ? Boolean(r.deletedAt)
        : !r.deletedAt &&
          matches.has(r.id) &&
          (tab === "all"
            ? !["review", "attempt", "card"].includes(r.kind)
            : tab === "image"
              ? r.kind === "note" && Boolean(r.image)
              : r.kind === tab),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  const selectedItem = data.knowledge.find(
    (r) => r.id === selected && !r.deletedAt,
  );
  const remove = async (r: KnowledgeRecord) => {
    if (confirm(`«${r.title}»-г хогийн саванд шилжүүлэх үү?`)) {
      if (
        await run(
          () => store.mutate(removeKnowledge(r.id)),
          "Хогийн саванд шилжүүллээ. Буцааж сэргээж болно.",
        )
      )
        setSelected(null);
    }
  };
  const restore = (r: KnowledgeRecord) =>
    run(
      () =>
        store.mutate((d) => ({
          ...d,
          knowledge: d.knowledge.map((v) =>
            v.id === r.id
              ? {
                  ...v,
                  deletedAt: null,
                  updatedAt: Math.max(Date.now(), v.updatedAt + 1),
                }
              : v,
          ),
        })),
      "Сэргээсэн.",
    );
  return (
    <div className="knowledge-page">
      <section className="knowledge-hero">
        <AnimatedBuddy mood="idea" />
        <div>
          <span className="eyebrow">МИНИЙ МЭДЛЭГ</span>
          <h2>
            Сурсан зүйлээ
            <br />
            <em>өөртөө үлдээ.</em>
          </h2>
          <p>Тэмдэглэлээс ойлголт руу. Ойлголтоос тогтоосон мэдлэг рүү.</p>
        </div>
        <div className="review-today">
          <Icon name="book" size={28} />
          <strong>{index.due.length + index.fresh.length}</strong>
          <span>давтах карт</span>
          <small>
            {index.due.length} хугацаа болсон · {index.fresh.length} шинэ
          </small>
          <button
            className="button primary"
            onClick={() => setReview("all")}
            disabled={!index.reviewQueue.length}
          >
            Давтлага эхлүүлэх
          </button>
        </div>
      </section>
      <section
        className="knowledge-command-center"
        aria-label="Мэдлэгийн сангийн удирдлага"
      >
        <div className="knowledge-command-copy">
          <span className="eyebrow">МЭДЛЭГИЙН САН</span>
          <h3>Юу хийх вэ?</h3>
          <p>Шинэ зүйл нэмэх, давтах эсвэл өмнөх мэдлэгээ олох.</p>
        </div>
        <div
          className="knowledge-actions"
          role="group"
          aria-label="Мэдлэг нэмэх"
        >
          <button
            className="button primary"
            onClick={() => setEditor({ kind: "note" })}
          >
            <Icon name="plus" size={16} /> Тэмдэглэл
          </button>
          <button
            className="button"
            onClick={() => setEditor({ kind: "deck" })}
          >
            <Icon name="plus" size={16} /> Картын багц
          </button>
          <button className="button" onClick={() => setGenerator(true)}>
            <Icon name="spark" size={16} /> Карт үүсгэх
          </button>
          <button className="button" onClick={() => setQuizGenerator(true)}>
            <Icon name="spark" size={16} /> Quiz үүсгэх
          </button>
          <button
            className="text-button"
            onClick={() => setEditor({ kind: "quiz" })}
          >
            Сорил нэмэх
          </button>
          <button
            className="text-button"
            onClick={() => setEditor({ kind: "link" })}
          >
            Холбоос нэмэх
          </button>
        </div>
      </section>
      <nav className="knowledge-tabs" aria-label="Мэдлэгийн төрөл">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              setLimit(36);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="knowledge-toolbar">
        <label className="search-field">
          <Icon name="search" size={18} />
          <input
            aria-label="Мэдлэгийн сангаас хайх"
            placeholder="Мэдлэгээс хайх…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(36);
            }}
          />
        </label>
        <button
          className="button knowledge-filter-toggle"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Icon name="filter" size={16} />
          Шүүлтүүр
          {(subject || tag || from || to) && <span className="filter-dot" />}
        </button>
      </div>
      {showFilters && (
        <div className="knowledge-filters">
          <SubjectSelect all value={subject} onChange={setSubject} />
          <input
            aria-label="Шошгоор шүүх"
            placeholder="Шошго"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <label>
            Эхлэх өдөр
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Дуусах өдөр
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      )}
      {tab === "session" ? (
        <section className="card">
          <h2>Суралцсан хичээлүүд</h2>
          {data.sessions
            .filter((s) => !s.deletedAt && matches.has(s.id))
            .slice(0, limit)
            .map((s) => (
              <article key={s.id} className="knowledge-session">
                <strong>
                  {data.subjects.find((v) => v.id === s.subjectId)?.name}
                </strong>
                <span>
                  {s.date} · {formatTime(s.durationSec)}
                </span>
                <p>{s.note || "Тэмдэглэлгүй хэмжилт"}</p>
                <button
                  className="text-button"
                  onClick={() => navigate("calendar", s.id)}
                >
                  Календарьт харах
                </button>
              </article>
            ))}
          {!data.sessions.some((s) => !s.deletedAt && matches.has(s.id)) && (
            <Empty
              title="Хэмжилт олдсонгүй"
              description="Хичээлээ дуусгаж хадгалахад энд харагдана."
            />
          )}
        </section>
      ) : items.length ? (
        <div className="knowledge-grid">
          {items.slice(0, limit).map((r) => (
            <article
              className={`knowledge-card knowledge-${r.kind}`}
              key={r.id}
            >
              {r.kind === "note" && r.image && (
                <StoredImage loading="lazy" src={r.image} alt={r.title} />
              )}
              <div className="knowledge-card-body">
                <span className="eyebrow">{labels[r.kind]}</span>
                <button
                  className="knowledge-card-title"
                  onClick={() => setSelected(r.id)}
                  disabled={Boolean(r.deletedAt)}
                >
                  {r.title}
                </button>
                <p>
                  {r.kind === "note"
                    ? r.body.slice(0, 150)
                    : r.kind === "link"
                      ? r.description || new URL(r.url).hostname
                      : r.kind === "deck"
                        ? `${index.cardsByDeck.get(r.id)?.length ?? 0} карт · ${r.description}`
                        : r.kind === "quiz"
                          ? `${r.questions.length} асуулт`
                          : ""}
                </p>
                <div className="tag-list">
                  {r.tags.slice(0, 5).map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <div className="knowledge-card-footer">
                  <small>
                    {data.subjects.find((s) => s.id === r.subjectId)?.name ??
                      "Ерөнхий"}
                  </small>
                  {r.deletedAt ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void restore(r)}
                    >
                      Сэргээх
                    </button>
                  ) : r.kind === "deck" ? (
                    <button
                      className="text-button"
                      onClick={() => setReview(r.id)}
                    >
                      Давтах →
                    </button>
                  ) : r.kind === "quiz" ? (
                    <button className="text-button" onClick={() => setQuiz(r)}>
                      Сорих →
                    </button>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => setSelected(r.id)}
                    >
                      Нээх →
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title={
              tab === "trash" ? "Хогийн сав хоосон" : "Энд таны мэдлэг цугларна"
            }
            description="Нэг тэмдэглэл, зураг эсвэл холбоосоос эхэлж болно. Хайлт хийсэн бол шүүлтүүрээ өөрчлөөд үзээрэй."
            action={
              <button
                className="button primary"
                onClick={() => setEditor({ kind: "note" })}
              >
                Анхны тэмдэглэлээ нэмэх
              </button>
            }
          />
        </section>
      )}
      {(items.length > limit ||
        (tab === "session" && data.sessions.length > limit)) && (
        <button
          className="button load-more"
          onClick={() => setLimit((v) => v + 36)}
        >
          Дараагийн бичлэгүүд
        </button>
      )}
      {selectedItem && (
        <Modal title={selectedItem.title} onClose={() => setSelected(null)}>
          <article className="knowledge-detail">
            <span className="eyebrow">{labels[selectedItem.kind]}</span>
            {selectedItem.kind === "note" && (
              <>
                {selectedItem.image && (
                  <StoredImage
                    src={selectedItem.image}
                    alt={selectedItem.title}
                  />
                )}
                <MarkdownView value={selectedItem.body} />
                {selectedItem.links.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {url} ↗
                  </a>
                ))}
              </>
            )}
            {selectedItem.kind === "link" && (
              <>
                <p>{selectedItem.description}</p>
                <a
                  className="button"
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Холбоос нээх ↗
                </a>
              </>
            )}
            {selectedItem.kind === "deck" && (
              <>
                <p>{selectedItem.description}</p>
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() => {
                      setReview(selectedItem.id);
                      setSelected(null);
                    }}
                  >
                    Давтах
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setEditor({ kind: "card", deckId: selectedItem.id });
                      setSelected(null);
                    }}
                  >
                    Карт нэмэх
                  </button>
                </div>
                {(index.cardsByDeck.get(selectedItem.id) ?? [])
                  .slice(0, cardLimit)
                  .map((c) => (
                    <div className="deck-card-row" key={c.id}>
                      <span>
                        {c.front}
                        <small>Дараагийн давтлага: {c.schedule.dueOn}</small>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditor({ kind: "card", record: c });
                          setSelected(null);
                        }}
                      >
                        Засах
                      </button>
                      <button
                        className="text-button danger-text"
                        onClick={() => void remove(c)}
                      >
                        Устгах
                      </button>
                    </div>
                  ))}
                {(index.cardsByDeck.get(selectedItem.id)?.length ?? 0) >
                  cardLimit && (
                  <button
                    className="button"
                    onClick={() => setCardLimit((v) => v + 100)}
                  >
                    Дараагийн картууд
                  </button>
                )}
                <p className="tiny muted">Сүүлийн давтлагууд</p>
                {data.knowledge
                  .filter(
                    (r) =>
                      r.kind === "review" &&
                      !r.deletedAt &&
                      index.byId.get(r.cardId)?.kind === "card" &&
                      (
                        index.byId.get(
                          r.cardId,
                        ) as import("@/types/knowledge").Flashcard
                      ).deckId === selectedItem.id,
                  )
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .slice(0, 12)
                  .map((r) => (
                    <p className="tiny" key={r.id}>
                      {r.kind === "review" &&
                        `${new Date(r.reviewedAt).toLocaleString("mn-MN")} · ${r.title} · ${r.grade}/5`}
                    </p>
                  ))}
              </>
            )}
            {selectedItem.kind === "card" && (
              <>
                <h3>{selectedItem.front}</h3>
                <p className="preserve-lines">{selectedItem.back}</p>
                <p>Дараагийн давтлага: {selectedItem.schedule.dueOn}</p>
              </>
            )}
            {selectedItem.kind === "quiz" && (
              <>
                <p>{selectedItem.questions.length} асуулт</p>
                <button
                  className="button primary"
                  onClick={() => {
                    setQuiz(selectedItem);
                    setSelected(null);
                  }}
                >
                  Сорил эхлүүлэх
                </button>
                {data.knowledge
                  .filter(
                    (r) =>
                      r.kind === "attempt" &&
                      r.quizId === selectedItem.id &&
                      !r.deletedAt,
                  )
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .slice(0, 10)
                  .map((r) => (
                    <p key={r.id}>
                      {r.kind === "attempt" &&
                        `${r.date} · ${r.score}/${r.total}`}
                    </p>
                  ))}
              </>
            )}
            {selectedItem.kind === "attempt" && (
              <>
                <p>
                  {selectedItem.score}/{selectedItem.total} зөв
                </p>
                {selectedItem.answers.map((a) => (
                  <div key={a.question.id}>
                    <h3>{a.question.prompt}</h3>
                    <p>
                      {a.response} · {a.correct ? "Зөв" : "Дахин харах"}
                    </p>
                    <p>Зөв хариулт: {a.question.answer}</p>
                  </div>
                ))}
              </>
            )}
            {selectedItem.kind === "review" && (
              <p>
                Үнэлгээ: {selectedItem.grade}/5 · Дараагийн давтлага:{" "}
                {selectedItem.after.dueOn}
              </p>
            )}
            <div className="button-row">
              {!["attempt", "review"].includes(selectedItem.kind) && (
                <button
                  className="button"
                  onClick={() => {
                    setEditor({
                      kind: selectedItem.kind as EditableKind,
                      record: selectedItem,
                    });
                    setSelected(null);
                  }}
                >
                  Засах
                </button>
              )}
              <button
                className="text-button danger-text"
                onClick={() => void remove(selectedItem)}
              >
                Хогийн саванд шилжүүлэх
              </button>
            </div>
          </article>
        </Modal>
      )}
      {editor && (
        <ModuleBoundary name="Бичлэг засах">
          <KnowledgeEditor {...editor} onClose={() => setEditor(null)} />
        </ModuleBoundary>
      )}
      {review && (
        <CardReview
          deckId={review === "all" ? undefined : review}
          onClose={() => setReview(null)}
        />
      )}{" "}
      {quiz && <QuizSession quiz={quiz} onClose={() => setQuiz(null)} />}{" "}
      {generator && <CardGenerator onClose={() => setGenerator(false)} />}
      {quizGenerator && <QuizGenerator onClose={() => setQuizGenerator(false)} />}
    </div>
  );
}
