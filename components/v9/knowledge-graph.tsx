"use client";

import { useMemo, useState } from "react";
import type {
  Flashcard,
  FlashcardDeck,
  KnowledgeRecord,
  StudyNote,
  StudyQuiz,
  StudyTopic,
} from "@/types/knowledge";
import type { Subject } from "@/types/study";

interface KnowledgeGraphProps {
  subjects: Subject[];
  records: KnowledgeRecord[];
  today: string;
  onSelectSubject: (subjectId: string) => void;
  onReviewDeck: (deckId: string) => void;
}

export function KnowledgeGraph({
  subjects,
  records,
  today,
  onSelectSubject,
  onReviewDeck,
}: KnowledgeGraphProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  const activeRecords = useMemo(
    () => records.filter((r) => !r.deletedAt),
    [records],
  );

  const statsBySubject = useMemo(() => {
    const cards = activeRecords.filter(
      (r): r is Flashcard => r.kind === "card",
    );
    const groups = [
      ...subjects.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color || "#6366f1",
      })),
      { id: "unassigned", name: "Ерөнхий мэдлэг", color: "#94a3b8" },
    ];

    return groups
      .map((g) => {
        const matchSub = (sid: string | null) =>
          g.id === "unassigned" ? !sid : sid === g.id;
        const notes = activeRecords.filter(
          (r): r is StudyNote => r.kind === "note" && matchSub(r.subjectId),
        );
        const topics = activeRecords.filter(
          (r): r is StudyTopic => r.kind === "topic" && matchSub(r.subjectId),
        );
        const decks = activeRecords.filter(
          (r): r is FlashcardDeck => r.kind === "deck" && matchSub(r.subjectId),
        );
        const quizzes = activeRecords.filter(
          (r): r is StudyQuiz => r.kind === "quiz" && matchSub(r.subjectId),
        );
        const deckIds = new Set(decks.map((d) => d.id));
        const subCards = cards.filter(
          (c) => matchSub(c.subjectId) || deckIds.has(c.deckId),
        );
        const dueCount = subCards.filter(
          (c) => c.schedule.dueOn <= today,
        ).length;
        const masteredCount = subCards.filter(
          (c) => c.schedule.interval >= 7,
        ).length;
        const masteryPct =
          subCards.length > 0
            ? Math.round((masteredCount / subCards.length) * 100)
            : notes.length > 0
              ? 50
              : 0;

        return {
          ...g,
          notes,
          topics,
          decks,
          quizzes,
          cardCount: subCards.length,
          dueCount,
          masteryPct,
          totalItems:
            notes.length + topics.length + decks.length + quizzes.length,
        };
      })
      .filter((g) => g.totalItems > 0 || g.id !== "unassigned");
  }, [activeRecords, subjects, today]);

  const visibleGroups =
    selectedSubject === "all"
      ? statsBySubject
      : statsBySubject.filter((g) => g.id === selectedSubject);

  return (
    <section
      aria-label="Мэдлэгийн газрын зураг"
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
            🕸️ Knowledge Map
          </span>
          <h3 className="text-sm font-semibold text-white">
            Мэдлэгийн холбоос ба эзэмшилт
          </h3>
        </div>
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedSubject("all")}
            className={`min-h-[34px] shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedSubject === "all"
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Бүгд ({statsBySubject.length})
          </button>
          {statsBySubject.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedSubject(g.id)}
              className={`min-h-[34px] shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedSubject === g.id
                  ? "bg-indigo-500 text-white"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile-friendly touch node network */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibleGroups.map((group) => (
          <div
            key={group.id}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-3.5 transition hover:border-indigo-400/30"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  onSelectSubject(group.id === "unassigned" ? "" : group.id)
                }
                className="flex items-center gap-2 text-left font-semibold text-slate-100 hover:text-indigo-300"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-sm">{group.name}</span>
              </button>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  group.dueCount > 0
                    ? "bg-amber-500/20 text-amber-200"
                    : "bg-emerald-500/20 text-emerald-200"
                }`}
              >
                {group.dueCount > 0
                  ? `⏰ ${group.dueCount} давтах`
                  : `✨ Эзэмшилт ${group.masteryPct}%`}
              </span>
            </div>

            {/* Visual mastery bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(8, group.masteryPct)}%`,
                  backgroundColor: group.color,
                }}
              />
            </div>

            {/* Connected child nodes (Topics, Notes, Decks, Quizzes) */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {group.topics.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200"
                >
                  🧭 {t.title}
                </span>
              ))}
              {group.notes.slice(0, 4).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() =>
                    onSelectSubject(group.id === "unassigned" ? "" : group.id)
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  📝 {n.title.slice(0, 26)}
                </button>
              ))}
              {group.decks.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onReviewDeck(d.id)}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/25"
                >
                  🗂️ {d.title.slice(0, 24)} ▶
                </button>
              ))}
              {group.quizzes.slice(0, 2).map((q) => (
                <span
                  key={q.id}
                  className="rounded-lg border border-purple-400/25 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-200"
                >
                  🧠 {q.title.slice(0, 22)}
                </span>
              ))}
              {group.totalItems === 0 && (
                <span className="text-[11px] text-slate-500">
                  Одоогоор тэмдэглэл эсвэл карт нэмээгүй байна.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
