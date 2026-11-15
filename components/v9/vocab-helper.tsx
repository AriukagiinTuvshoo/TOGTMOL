"use client";

import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { useI18n } from "@/components/i18n/language-provider";
import { addCards, recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { createGeminiChatProvider } from "@/lib/assistant/gemini";
import { isTtsSupported, speakText } from "@/lib/voice/speech-engine";
import type { Flashcard, FlashcardDeck } from "@/types/knowledge";

export interface VocabEntry {
  mn: string;
  en: string;
  ja: string;
  romaji: string;
  category: string;
  example: string;
}

export const CORE_VOCAB: VocabEntry[] = [
  {
    mn: "төвлөрөл / анхаарал",
    en: "focus / concentration",
    ja: "集中 (しゅうちゅう)",
    romaji: "shuuchuu",
    category: "Суралцах",
    example: "深い集中で勉強する — Гүн төвлөрлөөр хичээллэх.",
  },
  {
    mn: "давтлага / сэргээн санах",
    en: "review / active recall",
    ja: "復習 (ふくしゅう)",
    romaji: "fukushuu",
    category: "Суралцах",
    example: "毎日15分復習します — Өдөр бүр 15 минут давтана.",
  },
  {
    mn: "зорилго",
    en: "goal / objective",
    ja: "目標 (もくひょう)",
    romaji: "mokuhyou",
    category: "Төлөвлөлт",
    example: "今週の目標を決める — Энэ 7 хоногийн зорилгоо тодорхойлох.",
  },
  {
    mn: "зуршил / тууштай байдал",
    en: "habit / consistency",
    ja: "習慣 (しゅうかん)",
    romaji: "shuukan",
    category: "Төлөвлөлт",
    example: "小さな習慣が大きな結果を生む — Жижиг зуршил том үр дүн авчирна.",
  },
  {
    mn: "шалгалт",
    en: "examination / test",
    ja: "試験 (しけん)",
    romaji: "shiken",
    category: "Сургууль",
    example: "来月の試験に向けて準備する — Ирэх сарын шалгалтад бэлдэх.",
  },
  {
    mn: "ой санамж",
    en: "memory / retention",
    ja: "記憶 (きおく)",
    romaji: "kioku",
    category: "Тархи",
    example: "長期記憶に定着させる — Урт хугацааны ой санамжид батжуулах.",
  },
  {
    mn: "судалгаа / шинжилгээ",
    en: "research / analysis",
    ja: "研究 (けんきゅう)",
    romaji: "kenkyuu",
    category: "Шинжлэх ухаан",
    example: "新しい研究テーマを探す — Судалгааны шинэ сэдэв хайх.",
  },
  {
    mn: "шийдэл / арга зам",
    en: "solution / approach",
    ja: "解決 (かいけつ)",
    romaji: "kaiketsu",
    category: "Бодлого",
    example: "問題を一歩ずつ解決する — Асуудлыг алхам алхмаар шийдэх.",
  },
  {
    mn: "талархал / тайван байдал",
    en: "calmness / composure",
    ja: "落ち着き (おちつき)",
    romaji: "ochitsuki",
    category: "Сэтгэл зүй",
    example: "心を落ち着けて始める — Сэтгэлээ тайвшруулаад эхлэх.",
  },
  {
    mn: "амжилт / ахиц дэвшил",
    en: "progress / improvement",
    ja: "進歩 (しんぽ)",
    romaji: "shinpo",
    category: "Суралцах",
    example: "毎日の小さな進歩を祝う — Өдөр бүрийн жижиг ахицаа үнэлэх.",
  },
];

export function VocabHelper() {
  const { data, index, store, run, today } = useStudy();
  const { language } = useI18n();
  const [query, setQuery] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return CORE_VOCAB.slice(0, 5);
    return CORE_VOCAB.filter(
      (item) =>
        item.mn.toLocaleLowerCase().includes(q) ||
        item.en.toLocaleLowerCase().includes(q) ||
        item.ja.toLocaleLowerCase().includes(q) ||
        item.romaji.toLocaleLowerCase().includes(q),
    );
  }, [query]);

  const askGeminiVocab = async () => {
    const word = query.trim();
    if (!word) return;
    setBusy(true);
    setAiResult(null);
    try {
      const provider = createGeminiChatProvider(false, language);
      const res = await provider.reply(
        `Give a concise trilingual vocabulary breakdown for "${word}" in Mongolian (MN), English (EN), and Japanese (JA with Kanji + Furigana/Reading + Romaji) plus 1 natural example sentence.`,
        {
          data,
          index,
          today,
          language,
        },
      );
      setAiResult(res.text);
    } catch (err) {
      setAiResult(
        err instanceof Error
          ? err.message
          : "Google AI толь бичиг түр холбогдсонгүй.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveWordAsCard = async (front: string, back: string) => {
    await run(async () => {
      const existingDeck = data.knowledge.find(
        (r): r is FlashcardDeck =>
          r.kind === "deck" && !r.deletedAt && r.title.includes("Үгийн сан"),
      );
      const deck: FlashcardDeck = existingDeck ?? {
        ...recordBase("🌏 MN · EN · JA Үгийн сан", null),
        kind: "deck",
        description: "Хурдан толь бичгээс хадгалсан үгс",
      };
      const card: Flashcard = {
        ...recordBase(front.slice(0, 140), deck.subjectId),
        kind: "card",
        deckId: deck.id,
        front,
        back,
        schedule: { repetitions: 0, interval: 0, ease: 2.5, dueOn: today },
      };
      await store.mutate((d) =>
        addCards([card])(existingDeck ? d : saveKnowledge(deck)(d)),
      );
    }, "Үгийн сангийн багцад карт болгон хадгаллаа! 🗂️");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Монгол, English эсвэл 日本語 үг бичих..."
          className="min-h-[44px] flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3.5 py-2 text-base text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none sm:text-sm"
        />
        <button
          type="button"
          disabled={busy || !query.trim()}
          onClick={() => void askGeminiVocab()}
          className="min-h-[44px] shrink-0 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-40"
        >
          {busy ? "Орчуулж байна..." : "✨ AI Дэлгэрэнгүй тайлбар"}
        </button>
      </div>

      {aiResult && (
        <div className="rounded-2xl border border-indigo-400/30 bg-indigo-950/35 p-3.5 text-xs leading-relaxed text-slate-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-indigo-300">
              🐾 Бондоок Гурван хэлний тайлбар
            </strong>
            <button
              type="button"
              onClick={() => void saveWordAsCard(query.trim(), aiResult)}
              className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30"
            >
              + Карт болгох
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-slate-200">
            {aiResult}
          </pre>
        </div>
      )}

      <div className="space-y-2">
        {matches.map((entry) => (
          <div
            key={entry.en}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-white">
                  🇲🇳 {entry.mn} · 🇬🇧 {entry.en}
                </div>
                <div className="mt-0.5 text-indigo-200">
                  🇯🇵 {entry.ja}{" "}
                  <span className="text-slate-400">({entry.romaji})</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isTtsSupported() && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        speakText(entry.en.split("/")[0]?.trim() || entry.en, {
                          lang: "en-US",
                          preset: "calm",
                        })
                      }
                      className="min-h-[34px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                      title="English дуудлага"
                    >
                      🔊 EN
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        speakText(entry.ja.replace(/\(.*?\)/g, "").trim(), {
                          lang: "ja-JP",
                          preset: "calm",
                        })
                      }
                      className="min-h-[34px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                      title="日本語 дуудлага"
                    >
                      🔊 JA
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    void saveWordAsCard(
                      `${entry.ja} · ${entry.en}`,
                      `🇲🇳 ${entry.mn}\n📝 ${entry.example}`,
                    )
                  }
                  className="min-h-[34px] rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/30"
                >
                  + Карт
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{entry.example}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
