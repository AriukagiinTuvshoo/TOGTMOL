"use client";
import { StoredImage } from "@/components/ui/stored-image";
import { useRef, useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { Modal, SubjectSelect } from "@/components/ui/common";
import { recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { cleanTags, safeLink } from "@/lib/knowledge/validation";
import { prepareImage } from "@/lib/knowledge/images";
import { uid } from "@/lib/constants";
import type { KnowledgeRecord, QuizQuestion } from "@/types/knowledge";
export type EditableKind = "note" | "deck" | "card" | "quiz" | "link";
const names: Record<EditableKind, string> = {
  note: "Тэмдэглэл",
  deck: "Картын багц",
  card: "Давтлагын карт",
  quiz: "Сорил",
  link: "Холбоос",
};
const newQuestion = (): QuizQuestion => ({
  id: uid("question"),
  type: "short",
  prompt: "",
  answer: "",
  options: ["", "", ""],
  explanation: "",
});
export function KnowledgeEditor({
  kind,
  record,
  deckId,
  onClose,
}: {
  kind: EditableKind;
  record?: KnowledgeRecord;
  deckId?: string;
  onClose: () => void;
}) {
  const { data, store, run, today } = useStudy(),
    { busy } = useStoreState();
  const [title, setTitle] = useState(record?.title ?? ""),
    [subject, setSubject] = useState(
      record?.subjectId ??
        data.knowledge.find((r) => r.id === deckId)?.subjectId ??
        "",
    ),
    [tags, setTags] = useState(record?.tags.join(", ") ?? "");
  const [body, setBody] = useState(
    record?.kind === "note"
      ? record.body
      : record?.kind === "deck" || record?.kind === "link"
        ? record.description
        : "",
  );
  const [image, setImage] = useState(
      record?.kind === "note" ? record.image : null,
    ),
    [imageBusy, setImageBusy] = useState(false),
    imageRequest = useRef(0);
  const [date, setDate] = useState(
      record?.kind === "note" ? record.date : today,
    ),
    [url, setUrl] = useState(record?.kind === "link" ? record.url : ""),
    [links, setLinks] = useState(
      record?.kind === "note" ? record.links.join("\n") : "",
    );
  const [deck, setDeck] = useState(
      record?.kind === "card" ? record.deckId : (deckId ?? ""),
    ),
    [front, setFront] = useState(record?.kind === "card" ? record.front : ""),
    [back, setBack] = useState(record?.kind === "card" ? record.back : "");
  const [questions, setQuestions] = useState(
    record?.kind === "quiz" ? record.questions : [newQuestion()],
  );
  const [related, setRelated] = useState(
    record?.kind === "link" ? record.relatedIds : [],
  );
  const updateQuestion = (id: string, patch: Partial<QuizQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const save = async () => {
    await run(async () => {
      const common = {
        ...(record ?? recordBase(title, subject || null, cleanTags(tags))),
        title:
          title.trim() || (kind === "card" ? front.trim().slice(0, 180) : ""),
        subjectId: subject || null,
        tags: cleanTags(tags),
      };
      let next: KnowledgeRecord;
      if (kind === "note")
        next = {
          ...common,
          kind,
          body,
          date,
          image,
          links: links
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map(safeLink),
        };
      else if (kind === "deck") next = { ...common, kind, description: body };
      else if (kind === "card")
        next = {
          ...common,
          kind,
          deckId: deck,
          front,
          back,
          schedule:
            record?.kind === "card"
              ? record.schedule
              : { repetitions: 0, interval: 0, ease: 2.5, dueOn: today },
        };
      else if (kind === "quiz") next = { ...common, kind, questions };
      else
        next = {
          ...common,
          kind,
          url: safeLink(url),
          description: body,
          relatedIds: related,
        };
      await store.mutate(saveKnowledge(next, record?.updatedAt));
      onClose();
    }, "Мэдлэгийн санд хадгаллаа.");
  };
  return (
    <Modal
      title={`${names[kind]} ${record ? "засах" : "нэмэх"}`}
      onClose={() => {
        if (!busy && !imageBusy) onClose();
      }}
    >
      <form
        className="form-stack knowledge-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Нэр
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={180}
            required={kind !== "card"}
            placeholder={
              kind === "card" ? "Хоосон бол асуултыг нэр болгоно" : undefined
            }
            autoFocus
          />
        </label>
        <div className="form-grid">
          <SubjectSelect value={subject} onChange={setSubject} />
          <label>
            Шошго
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Python, шалгалт"
              maxLength={1800}
            />
          </label>
        </div>
        {(kind === "note" || kind === "deck" || kind === "link") && (
          <label>
            {kind === "note" ? "Тэмдэглэл" : "Тайлбар"}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={kind === "note" ? 7 : 3}
              maxLength={50000}
            />
          </label>
        )}
        {kind === "note" && (
          <>
            <label>
              Өдөр
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="button file-button">
              {imageBusy ? "Зургийг бэлдэж байна…" : "Зураг хавсаргах"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={imageBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const token = ++imageRequest.current;
                  setImageBusy(true);
                  void run(async () => {
                    try {
                      const result = await prepareImage(file);
                      if (imageRequest.current === token) setImage(result);
                    } finally {
                      if (imageRequest.current === token) setImageBusy(false);
                    }
                  });
                }}
              />
            </label>
            {image && (
              <div className="note-image-preview">
                {/* Local re-encoded image; no remote image optimizer. */}
                <StoredImage
                  src={image}
                  alt={title || "Хавсаргасан суралцах зураг"}
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setImage(null)}
                >
                  Зургийг салгах
                </button>
              </div>
            )}
            <p className="tiny muted">
              Зураг энэ төхөөрөмж дээр боловсруулагдана. Үүлэн синкээ асаасан
              бол хувийн бүртгэлд хамт хадгалагдана.
            </p>
            <label>
              Холбогдох холбоосууд
              <textarea
                rows={2}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="Мөр бүрт нэг https холбоос"
              />
            </label>
          </>
        )}
        {kind === "card" && (
          <>
            <label>
              Багц
              <select
                value={deck}
                required
                onChange={(e) => setDeck(e.target.value)}
              >
                <option value="">Багц сонгох</option>
                {data.knowledge
                  .filter((r) => r.kind === "deck" && !r.deletedAt)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Асуулт
              <textarea
                required
                value={front}
                onChange={(e) => {
                  setFront(e.target.value);
                }}
                rows={3}
                maxLength={4000}
              />
            </label>
            <label>
              Хариулт
              <textarea
                required
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={5}
                maxLength={10000}
              />
            </label>
          </>
        )}
        {kind === "quiz" && (
          <div className="quiz-editor">
            {questions.map((q, i) => (
              <fieldset key={q.id}>
                <legend>Асуулт {i + 1}</legend>
                <label>
                  Төрөл
                  <select
                    value={q.type}
                    onChange={(e) =>
                      updateQuestion(q.id, {
                        type: e.target.value as QuizQuestion["type"],
                        options:
                          e.target.value === "choice" && q.options.length < 2
                            ? ["", "", ""]
                            : q.options,
                        answer: e.target.value === "boolean" ? "Үнэн" : "",
                      })
                    }
                  >
                    <option value="short">Богино хариулт</option>
                    <option value="choice">Сонгох</option>
                    <option value="boolean">Үнэн / Худал</option>
                  </select>
                </label>
                <label>
                  Асуулт
                  <textarea
                    value={q.prompt}
                    required
                    onChange={(e) =>
                      updateQuestion(q.id, { prompt: e.target.value })
                    }
                    maxLength={4000}
                  />
                </label>
                {q.type === "choice" &&
                  q.options.map((option, j) => (
                    <label key={j}>
                      Сонголт {j + 1}
                      <input
                        required
                        value={option}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            options: q.options.map((v, k) =>
                              k === j ? e.target.value : v,
                            ),
                            answer:
                              q.answer === option ? e.target.value : q.answer,
                          })
                        }
                      />
                    </label>
                  ))}
                <label>
                  Зөв хариулт
                  {q.type === "short" ? (
                    <input
                      required
                      value={q.answer}
                      onChange={(e) =>
                        updateQuestion(q.id, { answer: e.target.value })
                      }
                    />
                  ) : (
                    <select
                      required
                      value={q.answer}
                      onChange={(e) =>
                        updateQuestion(q.id, { answer: e.target.value })
                      }
                    >
                      <option value="">Сонгох</option>
                      {(q.type === "boolean"
                        ? ["Үнэн", "Худал"]
                        : q.options
                      ).map((o, j) => (
                        <option key={j} value={o}>
                          {o || `Сонголт ${j + 1}`}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label>
                  Тайлбар
                  <input
                    value={q.explanation}
                    onChange={(e) =>
                      updateQuestion(q.id, { explanation: e.target.value })
                    }
                  />
                </label>
                {questions.length > 1 && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      setQuestions((qs) => qs.filter((x) => x.id !== q.id))
                    }
                  >
                    Энэ асуултыг хасах
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              className="button"
              disabled={questions.length >= 30}
              onClick={() => setQuestions((qs) => [...qs, newQuestion()])}
            >
              Асуулт нэмэх
            </button>
          </div>
        )}
        {kind === "link" && (
          <>
            <label>
              Холбоос
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                maxLength={4096}
              />
            </label>
            <label>
              Холбох зорилго / тэмдэглэл / багц / хэмжилт
              <select
                value={related[0] ?? ""}
                onChange={(e) =>
                  setRelated(e.target.value ? [e.target.value] : [])
                }
              >
                <option value="">Сонгохгүй</option>
                {[
                  ...data.studyGoals,
                  ...data.knowledge.filter((r) =>
                    ["note", "deck"].includes(r.kind),
                  ),
                ]
                  .filter((r) => !r.deletedAt)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                {data.sessions
                  .filter((s) => !s.deletedAt)
                  .slice(-100)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.date} · {s.note.slice(0, 40) || "Хэмжилт"}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        <button className="button primary" disabled={busy || imageBusy}>
          {busy ? "Хадгалж байна…" : "Хадгалах"}
        </button>
      </form>
    </Modal>
  );
}
