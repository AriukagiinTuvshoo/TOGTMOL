"use client";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { Modal, SubjectSelect } from "@/components/ui/common";
import { getSupabase } from "@/lib/supabase/client";
import {
  localQuizDrafts,
  parseQuizDrafts,
  type QuizDraft,
} from "@/lib/knowledge/generation";
import { recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { uid } from "@/lib/constants";
import type { QuizQuestion, StudyQuiz } from "@/types/knowledge";
import { useI18n } from "@/components/i18n/language-provider";

export function QuizGenerator({ onClose }: { onClose: () => void }) {
  const { data, store, run } = useStudy();
  const { language } = useI18n();
  const [title, setTitle] = useState("Бондоок · Миний сорил"),
    [subject, setSubject] = useState(""),
    [source, setSource] = useState(""),
    [text, setText] = useState(""),
    [online, setOnline] = useState(false),
    [count, setCount] = useState(5),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState<QuizDraft[] | null>(null);
  const disposed = useRef(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      pending.current?.abort();
    };
  }, []);

  const notes = data.knowledge.filter(
    (r) =>
      r.kind === "note" &&
      !r.deletedAt &&
      (!subject || r.subjectId === subject),
  );

  const generate = async () => {
    const namespace = store.getSnapshot().namespace;
    setBusy(true);
    setError("");
    try {
      if (!online) {
        setDrafts(localQuizDrafts(text, count));
        return;
      }
      const client = getSupabase();
      const session = client
        ? (await client.auth.getSession()).data.session
        : null;
      if (!session || namespace !== `account:${session.user.id}`)
        throw Error(
          "Онлайн Бондоокийг ашиглахын тулд бүртгэлээрээ нэвтэрнэ үү.",
        );

      const controller = new AbortController();
      pending.current = controller;
      const timer = window.setTimeout(() => controller.abort(), 35000);
      try {
        const response = await fetch("/api/bondook/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text, count, language }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "Quiz бэлдэж чадсангүй.");
        const parsed = parseQuizDrafts(result);
        if (!disposed.current) setDrafts(parsed);
      } finally {
        window.clearTimeout(timer);
      }
    } catch (e) {
      if (!disposed.current)
        setError(e instanceof Error ? e.message : "Холбогдсонгүй.");
    } finally {
      if (!disposed.current) setBusy(false);
    }
  };

  const save = async () => {
    if (!drafts?.length) return;
    setBusy(true);
    const ok = await run(async () => {
      const questions: QuizQuestion[] = parseQuizDrafts({
        questions: drafts,
      }).map((q) => ({
        id: uid("question"),
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
      }));
      const quiz: StudyQuiz = {
        ...recordBase(title, subject || null),
        kind: "quiz",
        questions,
      };
      await store.mutate(saveKnowledge(quiz));
    }, "Бондоокийн сорилыг хадгаллаа.");
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Бондоок · тэмдэглэлээс Quiz руу" onClose={onClose}>
      <div className="form-stack">
        {!drafts ? (
          <>
            <label>
              Сэдэв
              <SubjectSelect value={subject} onChange={setSubject} />
            </label>
            <label>
              Эх материал
              <select
                value={source}
                onChange={(e) => {
                  const id = e.target.value;
                  setSource(id);
                  if (id === "subject") {
                    setText(
                      notes
                        .map((r) =>
                          r.kind === "note" ? `${r.title}\\n${r.body}` : "",
                        )
                        .join("\\n\\n")
                        .slice(0, 12000),
                    );
                    return;
                  }
                  const note = notes.find((r) => r.id === id);
                  if (note?.kind === "note") {
                    setText(note.body.slice(0, 12000));
                    setTitle(note.title + " · Quiz");
                  }
                }}
              >
                <option value="">Текстээ оруулах</option>
                {subject && (
                  <option value="subject">Энэ хичээлийн тэмдэглэлүүд</option>
                )}
                {notes.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Суралцах материал
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={12000}
                placeholder="Жишээ: Python функц нь дахин ашиглах кодын хэсэг..."
              />
            </label>
            <label>
              Асуултын тоо
              <input
                type="number"
                min={2}
                max={12}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={online}
                onChange={(e) => setOnline(e.target.checked)}
              />
              Онлайн Бондоок ашиглах
            </label>
            <p className="tiny muted">
              Онлайн горимд зөвхөн дээрх материал AI руу илгээгдэнэ. Эхлээд
              асуулт бүрийг хянаад, дараа нь хадгална.
            </p>
            <button
              className="button primary"
              disabled={busy || !text.trim() || count < 2 || count > 12}
              onClick={() => void generate()}
            >
              {busy
                ? "Бэлдэж байна…"
                : online
                  ? "AI Quiz бэлдэх"
                  : "Local Quiz бэлдэх"}
            </button>
          </>
        ) : (
          <>
            <p className="tiny muted">
              Хадгалахаас өмнө бүх асуулт, сонголт, зөв хариултыг хянаарай.
            </p>
            {drafts.map((q, i) => (
              <fieldset key={i}>
                <legend>{i + 1}. Асуулт</legend>
                <label>
                  Төрөл
                  <select
                    value={q.type}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds!.map((d, j) =>
                          j === i
                            ? {
                                ...d,
                                type: e.target.value as QuizDraft["type"],
                              }
                            : d,
                        ),
                      )
                    }
                  >
                    <option value="choice">Сонгох</option>
                    <option value="boolean">Үнэн / Худал</option>
                    <option value="short">Богино хариулт</option>
                  </select>
                </label>
                <label>
                  Асуулт
                  <textarea
                    value={q.prompt}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds!.map((d, j) =>
                          j === i ? { ...d, prompt: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                {q.type === "choice" && (
                  <label>
                    Сонголтууд (мөр тус бүр)
                    <textarea
                      value={q.options.join("\\n")}
                      onChange={(e) =>
                        setDrafts((ds) =>
                          ds!.map((d, j) =>
                            j === i
                              ? {
                                  ...d,
                                  options: e.target.value
                                    .split(/\\n+/)
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                }
                              : d,
                          ),
                        )
                      }
                    />
                  </label>
                )}
                <label>
                  Зөв хариулт
                  <input
                    value={q.answer}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds!.map((d, j) =>
                          j === i ? { ...d, answer: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Тайлбар
                  <textarea
                    value={q.explanation}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds!.map((d, j) =>
                          j === i ? { ...d, explanation: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() =>
                    setDrafts((ds) => ds!.filter((_, j) => j !== i))
                  }
                >
                  Энэ асуултыг хасах
                </button>
              </fieldset>
            ))}
            <div className="button-row">
              <button
                className="button"
                disabled={busy}
                onClick={() => setDrafts(null)}
              >
                Буцах
              </button>
              <button
                className="button primary"
                disabled={busy || !drafts.length}
                onClick={() => void save()}
              >
                Хянасан Quiz хадгалах
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <button className="text-button" onClick={() => setOnline(false)}>
              Local горим
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
