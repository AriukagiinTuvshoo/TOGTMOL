"use client";
import { useMemo, useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { cardKey, importCards } from "@/lib/knowledge/actions";
import {
  downloadText,
  SectionTitle,
  SubjectSelect,
} from "@/components/ui/common";
import {
  parseAnkiText,
  toAnkiTsv,
  toCsv,
  type ExportCard,
} from "@/lib/knowledge/anki";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";

export function TransferSettings() {
  const { data, store, run, today } = useStudy(),
    { busy } = useStoreState();
  const [raw, setRaw] = useState(""),
    [fileName, setFileName] = useState(""),
    [title, setTitle] = useState(""),
    [subject, setSubject] = useState(""),
    [deckId, setDeckId] = useState(""),
    [splitDecks, setSplitDecks] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");

  const parsedResult = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      return { value: parseAnkiText(raw), error: "" };
    } catch (e) {
      return {
        value: null,
        error: e instanceof Error ? e.message : "Файлыг уншиж чадсангүй.",
      };
    }
  }, [raw]);
  const parsed = parsedResult?.value ?? null,
    parseError = parsedResult?.error ?? "";

  const decks = data.knowledge.filter(
      (r): r is FlashcardDeck => r.kind === "deck" && !r.deletedAt,
    ),
    cards = data.knowledge.filter(
      (r): r is Flashcard => r.kind === "card" && !r.deletedAt,
    );

  const duplicates = useMemo(() => {
    if (!parsed || !deckId) return 0;
    const keys = new Set(
      data.knowledge
        .filter(
          (r): r is Flashcard =>
            r.kind === "card" && r.deckId === deckId && !r.deletedAt,
        )
        .map((card) => cardKey(card.front)),
    );
    return parsed.rows.filter((row) => keys.has(cardKey(row.front))).length;
  }, [parsed, deckId, data.knowledge]);

  const rowDecks = useMemo(
    () => [
      ...new Set((parsed?.rows ?? []).map((row) => row.deck).filter(Boolean)),
    ],
    [parsed],
  );

  const chooseFile = async (file: File) => {
    setError("");
    setMessage("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл 5 MB-аас бага байх ёстой.");
      return;
    }
    if (/\.apkg$/i.test(file.name)) {
      setError(
        "Anki-ийн .apkg нь SQLite архив тул шууд уншигдахгүй. Anki дээр Файл → Экспорт → «Тэмдэглэл» (энгийн текст/CSV) сонгоод тэр файлыг оруулна уу.",
      );
      return;
    }
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setError("CSV, TSV эсвэл TXT файл сонгоно уу.");
      return;
    }
    const text = await file.text();
    const base = file.name.replace(/\.[^.]+$/, "");
    setFileName(file.name);
    setRaw(text);
    setTitle((current) => current || base.slice(0, 180));
  };

  const doImport = async () => {
    if (!parsed?.rows.length) return;
    const target = deckId
      ? ""
      : title.trim() || fileName.replace(/\.[^.]+$/, "").trim();
    if (!deckId && !target) {
      setError("Багцын нэрээ оруулна уу.");
      return;
    }
    setError("");
    setMessage("");
    const groups = splitDecks
      ? [...new Set(parsed.rows.map((row) => row.deck ?? target))].map(
          (name) => ({
            name,
            rows: parsed.rows.filter((row) => (row.deck ?? target) === name),
          }),
        )
      : [{ name: target, rows: parsed.rows }];
    let created = 0;
    const ok = await run(async () => {
      await store.mutate((current) => {
        let next = current;
        const before = current.knowledge.filter(
          (r) => r.kind === "card",
        ).length;
        for (const group of groups)
          next = importCards(
            group.rows.map((row) => ({
              front: row.front,
              back: row.back,
              tags: row.tags,
            })),
            {
              title: group.name,
              subjectId: subject || null,
              deckId: splitDecks ? undefined : deckId || undefined,
              today,
            },
          )(next);
        created =
          next.knowledge.filter((r) => r.kind === "card").length - before;
        return next;
      });
    }, "Импортыг хадгаллаа.");
    if (ok)
      setMessage(
        `${created} карт нэмэгдлээ${duplicates ? `, ${duplicates} давхардсан карт алгасагдлаа` : ""}${parsed.skipped ? `, ${parsed.skipped} мөр тохиромжгүй` : ""}.`,
      );
  };

  const exportCards: ExportCard[] = cards.map((card) => ({
    front: card.front,
    back: card.back,
    tags: card.tags,
    deck:
      decks.find((deck) => deck.id === card.deckId)?.title ??
      "Импортолсон багц",
  }));

  return (
    <section className="card">
      <SectionTitle
        title="Импорт ба экспорт"
        subtitle="Anki-ийн текст/CSV экспорт, бусад аппын CSV-тэй солилцоно. Юу ч сервер рүү явахгүй."
      />
      <div className="form-stack">
        <label className="button file-button">
          CSV / TSV / TXT файл сонгох
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void chooseFile(file);
            }}
          />
        </label>
        <label>
          Эсвэл текстээ энд буулгана уу
          <textarea
            rows={4}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setFileName("");
              setMessage("");
            }}
            placeholder={"#separator:tab\nАсуулт\tХариулт\tшошго"}
          />
        </label>
        {(error || parseError) && (
          <p className="tiny" role="alert">
            {error || parseError}
          </p>
        )}
        {parsed && (
          <>
            <p className="tiny muted">
              {parsed.rows.length} карт илэрлээ · тусгаарлагч{" "}
              {parsed.delimiter === "\t" ? "tab" : parsed.delimiter} ·{" "}
              {parsed.skipped} мөр алгасагдсан
              {parsed.html ? " · HTML цэвэрлэгдэнэ" : ""}
            </p>
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
            <label>
              Багц
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
              >
                <option value="">Шинэ багц үүсгэх</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Сэдэв
              <SubjectSelect value={subject} onChange={setSubject} all />
            </label>
            {rowDecks.length > 1 && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={splitDecks}
                  onChange={(e) => setSplitDecks(e.target.checked)}
                />
                Файл дахь багцын нэрээр тусад нь хуваах ({rowDecks.length} багц)
              </label>
            )}
            {duplicates > 0 && !splitDecks && (
              <p className="tiny muted">
                Сонгосон багцад ижил асуулттай {duplicates} карт байна — тэдгээр
                алгасагдана.
              </p>
            )}
            <div className="button-row">
              <button
                type="button"
                className="button primary"
                disabled={busy || !parsed.rows.length}
                onClick={() => void doImport()}
              >
                {parsed.rows.length} картыг импортлох
              </button>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  setRaw("");
                  setFileName("");
                  setTitle("");
                  setMessage("");
                  setError("");
                }}
              >
                Цэвэрлэх
              </button>
            </div>
          </>
        )}
        {message && (
          <p className="tiny muted" role="status">
            {message}
          </p>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={!cards.length}
            onClick={() =>
              downloadText(
                toAnkiTsv(exportCards),
                `togtmol-anki-${new Date().toISOString().slice(0, 10)}.txt`,
                "text/tab-separated-values;charset=utf-8",
              )
            }
          >
            Anki TSV татах ({cards.length})
          </button>
          <button
            type="button"
            className="button"
            disabled={!cards.length}
            onClick={() =>
              downloadText(
                toCsv(exportCards),
                `togtmol-cards-${new Date().toISOString().slice(0, 10)}.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            CSV татах
          </button>
        </div>
        <p className="tiny muted">
          Anki-д оруулахдаа Файл → Импорт → энэ TSV файлыг сонгоод, талбарыг
          Асуулт/Хариулт/Шошго гэж тохируулна. Anki-ийн .apkg архивыг энд шууд
          уншихгүй — Anki дээрээс «Тэмдэглэл» текст экспортоор гаргана.
        </p>
      </div>
    </section>
  );
}
