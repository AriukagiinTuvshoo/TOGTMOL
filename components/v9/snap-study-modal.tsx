"use client";

import { useRef, useState } from "react";
import { Modal, SubjectSelect } from "@/components/ui/common";
import { useStudy } from "@/hooks/use-study";
import { useI18n } from "@/components/i18n/language-provider";
import { prepareImage } from "@/lib/knowledge/images";
import { extractPdfText } from "@/lib/knowledge/pdf";
import { addCards, recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { localCardDrafts, localQuizDrafts } from "@/lib/knowledge/generation";
import {
  generateGeminiSnapStudy,
  type SnapStudyBundle,
} from "@/lib/assistant/gemini";
import { uid } from "@/lib/constants";
import type {
  Flashcard,
  FlashcardDeck,
  QuizQuestion,
  StudyNote,
  StudyQuiz,
} from "@/types/knowledge";

export function SnapStudyModal({ onClose }: { onClose: () => void }) {
  const { data, store, run, today } = useStudy();
  const { language } = useI18n();

  const [subject, setSubject] = useState<string>(data.subjects[0]?.id ?? "");
  const [image, setImage] = useState<string | null>(null);
  const [hintText, setHintText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<SnapStudyBundle | null>(null);
  const [saveNoteOpt, setSaveNoteOpt] = useState(true);
  const [saveCardsOpt, setSaveCardsOpt] = useState(true);
  const [saveQuizOpt, setSaveQuizOpt] = useState(true);

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const pdfRef = useRef<HTMLInputElement | null>(null);
  const [pdfInfo, setPdfInfo] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const encoded = await prepareImage(file);
      setImage(encoded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Зураг уншихад алдаа гарлаа.",
      );
    }
  };

  const handlePdfFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const res = await extractPdfText(bytes, 14000);
      setHintText(res.text);
      setPdfInfo(
        `📄 "${file.name}" (${res.pages} хуудас${res.truncated ? ", эхний хэсэг" : ""}) амжилттай уншлаа!`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "PDF файл уншихад алдаа гарлаа.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyze = async () => {
    if (!image && !hintText.trim()) {
      setError("Зураг дарах эсвэл хичээлийн тэмдэглэлээ бичнэ үү.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await generateGeminiSnapStudy({
        image,
        hintText,
        language,
      });
      setBundle(result);
    } catch (err) {
      if (hintText.trim().length >= 20) {
        // Offline / local fallback when text is present
        const fallbackTitle =
          hintText.trim().split("\n")[0]?.slice(0, 80) || "Хурдан задаргаа";
        setBundle({
          title: fallbackTitle,
          summaryMarkdown: `## ${fallbackTitle}\n\n${hintText.trim()}`,
          cards: localCardDrafts(hintText, fallbackTitle, 5),
          questions: localQuizDrafts(hintText, 3),
        });
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Google AI Studio зураг уншихад холбогдсонгүй. Түлхүүрээ шалгана уу.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAll = async () => {
    if (!bundle) return;
    setBusy(true);
    const ok = await run(async () => {
      const noteRecord: StudyNote | null = saveNoteOpt
        ? {
            ...recordBase(bundle.title, subject || null),
            kind: "note",
            body:
              bundle.summaryMarkdown ||
              `# ${bundle.title}\n\nЗургаас үүсгэсэн тэмдэглэл.`,
            date: today,
            image,
            links: [],
          }
        : null;

      const deckRecord: FlashcardDeck | null =
        saveCardsOpt && bundle.cards.length > 0
          ? {
              ...recordBase(`${bundle.title} · Карт`, subject || null),
              kind: "deck",
              description: "📸 Snap-to-Study · Бондоок AI үүсгэсэн багц",
              ...(noteRecord ? { sourceId: noteRecord.id } : {}),
            }
          : null;

      const cardRecords: Flashcard[] =
        deckRecord && bundle.cards.length > 0
          ? bundle.cards.map((c) => ({
              ...recordBase(c.front.slice(0, 180), subject || null),
              kind: "card",
              deckId: deckRecord.id,
              front: c.front,
              back: c.back,
              schedule: {
                repetitions: 0,
                interval: 0,
                ease: 2.5,
                dueOn: today,
              },
            }))
          : [];

      const quizQuestions: QuizQuestion[] =
        saveQuizOpt && bundle.questions.length > 0
          ? bundle.questions.map((q) => ({
              id: uid("question"),
              type: q.type,
              prompt: q.prompt,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
            }))
          : [];

      const quizRecord: StudyQuiz | null =
        quizQuestions.length > 0
          ? {
              ...recordBase(`${bundle.title} · Сорил`, subject || null),
              kind: "quiz",
              questions: quizQuestions,
            }
          : null;

      await store.mutate((d) => {
        let next = d;
        if (noteRecord) next = saveKnowledge(noteRecord)(next);
        if (deckRecord) {
          next = saveKnowledge(deckRecord)(next);
          next = addCards(cardRecords)(next);
        }
        if (quizRecord) next = saveKnowledge(quizRecord)(next);
        return next;
      });
    }, "Тэмдэглэл, карт болон сорилыг Мэдлэгийн санд хадгаллаа! 🎉");
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="📸 Snap-to-Study · Зургаас хичээл задлах" onClose={onClose}>
      <div className="space-y-4 text-slate-100">
        {!bundle ? (
          <>
            <p className="text-xs leading-relaxed text-slate-400">
              Дэвтэр, самбар эсвэл номын хуудсаа утсаараа дарахад Бондоок AI{" "}
              <strong className="text-indigo-300">цэгцтэй тэмдэглэл</strong>,{" "}
              <strong className="text-emerald-300">цээжлэх карт</strong>,{" "}
              <strong className="text-amber-300">шалгах сорил</strong> болгон
              бэлтгэнэ.
            </p>

            <label className="block text-xs text-slate-300">
              Хичээл сонгох
              <div className="mt-1">
                <SubjectSelect value={subject} onChange={setSubject} />
              </div>
            </label>

            {/* Mobile-first large touch camera, gallery & PDF buttons */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-indigo-400/40 bg-indigo-500/20 px-3 py-2.5 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30 active:scale-[0.99]"
              >
                <span>📷</span>
                <span>Камер дарах</span>
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 active:scale-[0.99]"
              >
                <span>🖼️</span>
                <span>Зураг сонгох</span>
              </button>
              <button
                type="button"
                onClick={() => pdfRef.current?.click()}
                className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border border-amber-400/35 bg-amber-500/15 px-3 py-2.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 active:scale-[0.99]"
              >
                <span>📄</span>
                <span>PDF лекц оруулах</span>
              </button>
            </div>

            {pdfInfo && (
              <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {pdfInfo}
              </p>
            )}

            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => void handlePdfFile(e.target.files?.[0])}
            />

            <input
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />

            {image && (
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/70 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt="Сонгосон хичээлийн зураг"
                  className="max-h-52 w-full rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute right-3 top-3 rounded-full bg-slate-900/90 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                >
                  ✕ Устгах
                </button>
              </div>
            )}

            <label className="block text-xs text-slate-300">
              Нэмэлт тайлбар эсвэл текст (заавал биш)
              <textarea
                rows={3}
                maxLength={15000}
                value={hintText}
                onChange={(e) => setHintText(e.target.value)}
                placeholder="Жишээ нь: Термодинамикийн 1-р хууль, эсвэл лекцийн текстээ шууд буулгаж болно..."
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none sm:text-sm"
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
              >
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
              >
                Хаах
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAnalyze()}
                className="min-h-[44px] rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:opacity-50"
              >
                {busy
                  ? "🐾 Бондоок уншиж байна..."
                  : "✨ Тэмдэглэл + Карт + Quiz үүсгэх"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3.5">
            <label className="block text-xs text-slate-300">
              Гарчиг
              <input
                type="text"
                value={bundle.title}
                onChange={(e) =>
                  setBundle({ ...bundle, title: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2 text-base font-semibold text-white sm:text-sm"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={saveNoteOpt}
                  onChange={(e) => setSaveNoteOpt(e.target.checked)}
                />
                <span>📝 Тэмдэглэл</span>
              </label>
              <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={saveCardsOpt}
                  onChange={(e) => setSaveCardsOpt(e.target.checked)}
                />
                <span>🗂️ Карт ({bundle.cards.length})</span>
              </label>
              <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={saveQuizOpt}
                  onChange={(e) => setSaveQuizOpt(e.target.checked)}
                />
                <span>🧠 Сорил ({bundle.questions.length})</span>
              </label>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-200">
              <div className="font-semibold text-indigo-300">
                📝 Хураангуй тэмдэглэл:
              </div>
              <pre className="whitespace-pre-wrap font-sans leading-relaxed text-slate-300">
                {bundle.summaryMarkdown.slice(0, 900)}
              </pre>
              {bundle.cards.length > 0 && (
                <div className="border-t border-white/10 pt-2">
                  <div className="mb-1 font-semibold text-emerald-300">
                    🗂️ Жишээ картууд:
                  </div>
                  {bundle.cards.slice(0, 3).map((c, idx) => (
                    <div
                      key={idx}
                      className="mb-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5"
                    >
                      <strong>А:</strong> {c.front} <br />
                      <span className="text-slate-400">
                        <strong>Х:</strong> {c.back}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBundle(null)}
                className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/10"
              >
                ← Буцах
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSaveAll()}
                className="min-h-[44px] rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy
                  ? "Хадгалж байна..."
                  : "✅ Бүгдийг Мэдлэгийн санд хадгалах"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
