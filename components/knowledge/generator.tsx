"use client";
import { StoredImage } from "@/components/ui/stored-image";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { Modal, SubjectSelect } from "@/components/ui/common";
import { getSupabase } from "@/lib/supabase/client";
import {
  localCardDrafts,
  parseCardDrafts,
  type CardDraft,
} from "@/lib/knowledge/generation";
import { addCards, recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { prepareImage } from "@/lib/knowledge/images";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";
import { useI18n } from "@/components/i18n/language-provider";
export function CardGenerator({ onClose }: { onClose: () => void }) {
  const { data, store, run, today } = useStudy();
  const { language } = useI18n();
  const [title, setTitle] = useState("Миний давтлага"),
    [subject, setSubject] = useState(""),
    [source, setSource] = useState(""),
    [text, setText] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [shareImage, setShareImage] = useState(false);
  const [online, setOnline] = useState(false),
    [count, setCount] = useState(10),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState<CardDraft[] | null>(null),
    [deckId, setDeckId] = useState("");
  const disposed = useRef(false),
    pending = useRef<AbortController | null>(null);
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
        setDrafts(localCardDrafts(text, title, count));
        return;
      }
      const client = getSupabase(),
        session = client ? (await client.auth.getSession()).data.session : null;
      if (
        !session ||
        namespace !== `account:${session.user.id}` ||
        store.getSnapshot().namespace !== namespace
      )
        throw Error(
          "Онлайн Бондоокийг ашиглахын тулд бүртгэлээрээ нэвтэрч, тэр бүртгэлийн горимд орно уу.",
        );
      await store.mutate((d) => {
        if (store.getSnapshot().namespace !== namespace)
          throw Error("Бүртгэл өөрчлөгдсөн.");
        return {
          ...d,
          settings: {
            ...d.settings,
            updatedAt: Date.now(),
            extras: { ...d.settings.extras, aiEnabled: true },
          },
        };
      });
      const controller = new AbortController();
      pending.current = controller;
      const timer = setTimeout(() => controller.abort(), 35000);
      try {
        const response = await fetch("/api/bondook/cards", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            text,
            count,
            image: shareImage ? image : null,
            language,
          }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "Карт бэлдэж чадсангүй.");
        const cards = parseCardDrafts(result);
        if (!disposed.current && store.getSnapshot().namespace === namespace)
          setDrafts(cards);
      } finally {
        clearTimeout(timer);
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
      const checked = parseCardDrafts({ cards: drafts });
      const existing = data.knowledge.find(
        (r): r is FlashcardDeck =>
          r.kind === "deck" && r.id === deckId && !r.deletedAt,
      );
      const deck = existing ?? {
        ...recordBase(title, subject || null),
        kind: "deck" as const,
        description: online
          ? "Бондоокийн санал, хэрэглэгч хянаж хадгалсан"
          : "Тэмдэглэлээс загвараар бэлдсэн, хэрэглэгч хянаж хадгалсан",
      };
      const cards: Flashcard[] = checked.map((c) => ({
        ...recordBase(c.front.slice(0, 180), subject || deck.subjectId),
        kind: "card",
        deckId: deck.id,
        front: c.front,
        back: c.back,
        schedule: { repetitions: 0, interval: 0, ease: 2.5, dueOn: today },
      }));
      await store.mutate((d) =>
        addCards(cards)(existing ? d : saveKnowledge(deck)(d)),
      );
    }, "Хянасан картуудыг хадгаллаа.");
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal
      title="Бондоок · тэмдэглэлээс карт руу"
      onClose={() => {
        pending.current?.abort();
        onClose();
      }}
    >
      <div className="form-stack">
        {!drafts ? (
          <>
            <SubjectSelect value={subject} onChange={setSubject} />
            <label>
              Эх материал
              <select
                value={source}
                onChange={(e) => {
                  const id = e.target.value;
                  setSource(id);
                  setShareImage(false);
                  if (id === "subject") {
                    setText(
                      notes
                        .map((r) =>
                          r.kind === "note" ? `${r.title}\n${r.body}` : "",
                        )
                        .join("\n\n")
                        .slice(0, 12000),
                    );
                    setImage(null);
                    return;
                  }
                  const note = notes.find((r) => r.id === id);
                  if (note?.kind === "note") {
                    setText(note.body.slice(0, 12000));
                    setImage(note.image);
                    setTitle(note.title);
                  }
                }}
              >
                <option value="">Текстээ оруулах</option>
                {subject && (
                  <option value="subject">
                    Энэ хичээлийн тэмдэглэлүүд (эхний 12,000 тэмдэгт)
                  </option>
                )}
                {notes.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Суралцах текст
              <textarea
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={12000}
                placeholder="Ойлголт: тайлбар гэсэн мөрүүд эсвэл суралцах текстээ оруулна уу."
              />
            </label>
            <label className="button file-button">
              Зураг сонгох
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    setBusy(true);
                    void run(async () => {
                      try {
                        const result = await prepareImage(file);
                        if (!disposed.current) setImage(result);
                      } finally {
                        if (!disposed.current) setBusy(false);
                      }
                    });
                  }
                }}
              />
            </label>
            {image && (
              <StoredImage
                className="generation-image"
                src={image}
                alt="Карт бэлдэхээр сонгосон материал"
              />
            )}
            <label>
              Бэлдэх картын дээд тоо
              <input
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <div className="ai-consent">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={online}
                  onChange={(e) => setOnline(e.target.checked)}
                />
                Онлайн Бондоокоор бэлдүүлэхийг зөвшөөрөх
              </label>
              <p className="tiny">
                Асаавал зөвхөн дээрх текст OpenAI-д илгээгдэнэ. Бусад түүх,
                зорилго, мэдээллийг илгээхгүй. Серверт AI холболт тохируулсан
                байх шаардлагатай.
              </p>
              {image && online && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={shareImage}
                    onChange={(e) => setShareImage(e.target.checked)}
                  />
                  Энэ зургийг мөн илгээхийг зөвшөөрөх
                </label>
              )}
            </div>
            <p className="tiny muted">
              Төхөөрөмж дээрх горим «ойлголт: тайлбар» мөрүүдээс загвар бэлдэнэ.
              Зургийн текстийг уншихгүй. Аль ч горимд та картыг хянаж байж
              хадгална.
            </p>
            <button
              className="button primary"
              disabled={
                busy ||
                (!text.trim() && !(online && shareImage && image)) ||
                count < 1 ||
                count > 12
              }
              onClick={() => void generate()}
            >
              {busy
                ? "Бэлдэж байна…"
                : online
                  ? "Бондоокоор бэлдүүлэх"
                  : "Төхөөрөмж дээр загвар бэлдэх"}
            </button>
          </>
        ) : (
          <>
            <p>
              Асуулт, хариулт бүрийг хянаж, шаардлагатайг засаарай. Одоогоор юу
              ч хадгалаагүй.
            </p>
            {drafts.map((c, i) => (
              <fieldset key={i}>
                <legend>Карт {i + 1}</legend>
                <label>
                  Асуулт
                  <textarea
                    value={c.front}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds!.map((d, j) =>
                          j === i ? { ...d, front: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Хариулт
                  <textarea
                    value={c.back}
                    rows={3}
                    onChange={(e) =>
                      setDrafts((ds) =>
                        ds!.map((d, j) =>
                          j === i ? { ...d, back: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() =>
                    setDrafts((ds) => ds!.filter((_, j) => i !== j))
                  }
                >
                  Энэ картыг хасах
                </button>
              </fieldset>
            ))}
            <label>
              Хадгалах багц
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
              >
                <option value="">Шинэ багц үүсгэх</option>
                {data.knowledge
                  .filter((r) => r.kind === "deck" && !r.deletedAt)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
              </select>
            </label>
            {!deckId && (
              <label>
                Шинэ багцын нэр
                <input
                  maxLength={180}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            )}
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
                disabled={busy || !drafts.length || (!deckId && !title.trim())}
                onClick={() => void save()}
              >
                Хянасан {drafts.length} картыг хадгалах
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <p>{error}</p>
            <button
              className="button small"
              onClick={() => {
                setOnline(false);
                setError("");
              }}
            >
              Төхөөрөмж дээр бэлдэх
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
