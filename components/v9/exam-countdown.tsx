"use client";

import { useMemo, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { SubjectSelect } from "@/components/ui/common";
import { actions } from "@/lib/persistence/actions";
import { uid } from "@/lib/constants";

export interface ExamItem {
  id: string;
  title: string;
  examDate: string; // YYYY-MM-DD
  targetHours: number;
  subjectId: string | null;
}

function readExams(raw: unknown): ExamItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid("exam"),
      title:
        typeof item.title === "string" ? item.title.slice(0, 80) : "Шалгалт",
      examDate:
        typeof item.examDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.examDate)
          ? item.examDate
          : "2026-12-15",
      targetHours:
        typeof item.targetHours === "number" && item.targetHours > 0
          ? Math.min(500, item.targetHours)
          : 20,
      subjectId:
        typeof item.subjectId === "string" && item.subjectId
          ? item.subjectId
          : null,
    }));
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.ceil((b - a) / 86_400_000);
}

export function ExamCountdown({ compact = false }: { compact?: boolean }) {
  const { data, store, today, run } = useStudy();
  const exams = useMemo(
    () => readExams(data.settings.extras.examCountdowns),
    [data.settings.extras.examCountdowns],
  );

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [targetHours, setTargetHours] = useState("20");
  const [subjectId, setSubjectId] = useState(
    data.subjects.find((s) => !s.deletedAt && !s.archived)?.id ?? "",
  );

  const saveExams = async (nextExams: ExamItem[], msg?: string) => {
    await run(async () => {
      await store.mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: {
            ...d.settings.extras,
            examCountdowns: nextExams,
          },
        },
      }));
    }, msg);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return;
    const item: ExamItem = {
      id: uid("exam"),
      title: title.trim().slice(0, 80),
      examDate,
      targetHours: Math.max(1, Math.min(500, Number(targetHours) || 20)),
      subjectId: subjectId || null,
    };
    await saveExams([...exams, item], "Шалгалтын тоолол нэмэгдлээ! 🎯");
    setTitle("");
    setAdding(false);
  };

  const scheduleTodayBlock = async (exam: ExamItem, recommendedMin: number) => {
    await run(async () => {
      await store.mutate((d) => {
        let next = d;
        let subId =
          exam.subjectId ||
          next.subjects.find((s) => !s.deletedAt && !s.archived)?.id ||
          "";
        if (!subId) {
          next = actions.addSubject("Шалгалтын бэлтгэл", "#818cf8")(next);
          subId = next.subjects[0]?.id ?? "";
        }
        if (!subId) return next;
        return actions.addTask({
          subjectId: subId,
          date: today,
          minutes: Math.max(15, Math.min(180, recommendedMin)),
          title: `🎯 ${exam.title} бэлтгэл`,
          startTime: "18:00",
        })(next);
      });
    }, "Өнөөдрийн хуваарьт цагийн блок нэмлээ! 📅");
  };

  return (
    <section className="v9-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
            ⏳ Exam Countdown & Pace
          </span>
          <h3 className="text-sm font-bold text-white">
            Шалгалтын тоолол ба өдрийн норм
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="min-h-[36px] rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-white/10"
        >
          {adding ? "Болих" : "+ Шалгалт нэмэх"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="mb-3 space-y-2.5 rounded-2xl border border-white/10 bg-black/30 p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Жишээ: JLPT N2, IELTS, Физикийн шалгалт"
              className="min-h-[42px] rounded-xl border border-white/15 bg-slate-950/80 px-3 text-base text-white sm:text-xs"
            />
            <input
              type="date"
              required
              min={today}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="min-h-[42px] rounded-xl border border-white/15 bg-slate-950/80 px-3 text-base text-white sm:text-xs"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SubjectSelect value={subjectId} onChange={setSubjectId} />
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300">
              <span>Зорилтот цаг:</span>
              <input
                type="number"
                min={1}
                max={500}
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                className="w-16 rounded-lg bg-white/10 px-2 py-1 text-center text-white"
              />
              <span>цаг</span>
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[40px] rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              Хадгалах
            </button>
          </div>
        </form>
      )}

      {exams.length === 0 ? (
        <p className="text-xs text-slate-400">
          Удахгүй өгөх шалгалтаа бүртгэвэл үлдсэн хоног болон өдөрт хичээллэх
          зохистой минутыг автоматаар тооцоолно.
        </p>
      ) : (
        <div className="space-y-2.5">
          {(compact ? exams.slice(0, 2) : exams).map((exam) => {
            const daysLeft = Math.max(0, daysBetween(today, exam.examDate));
            const studiedMin = Math.round(
              data.sessions
                .filter(
                  (s) =>
                    !s.deletedAt &&
                    (!exam.subjectId || s.subjectId === exam.subjectId),
                )
                .reduce((acc, s) => acc + s.durationSec, 0) / 60,
            );
            const targetMin = exam.targetHours * 60;
            const remainingMin = Math.max(0, targetMin - studiedMin);
            const dailyPaceMin =
              daysLeft > 0 ? Math.ceil(remainingMin / daysLeft) : remainingMin;
            const pct = Math.min(
              100,
              Math.round((studiedMin / Math.max(1, targetMin)) * 100),
            );

            return (
              <div
                key={exam.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {exam.title}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      📅 {exam.examDate} · Бэлтгэл {Math.round(studiedMin / 60)}
                      /{exam.targetHours} цаг ({pct}%)
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      daysLeft <= 7
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-amber-400/20 text-amber-200"
                    }`}
                  >
                    {daysLeft === 0 ? "Өнөөдөр!" : `${daysLeft} хоног үлдлээ`}
                  </span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-indigo-200">
                    {remainingMin === 0
                      ? "🎉 Зорилтот цагтаа хүрсэн байна!"
                      : `📌 Өдөрт ~${dailyPaceMin} мин суухад амжина`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {remainingMin > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          void scheduleTodayBlock(
                            exam,
                            Math.min(90, Math.max(20, dailyPaceMin)),
                          )
                        }
                        className="min-h-[34px] rounded-lg bg-indigo-500/25 px-2.5 py-1 text-[11px] font-semibold text-indigo-100 hover:bg-indigo-500/35"
                      >
                        + Өнөөдөр төлөвлөх
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void saveExams(
                          exams.filter((x) => x.id !== exam.id),
                          "Шалгалтыг хаслаа.",
                        )
                      }
                      aria-label={`${exam.title} устгах`}
                      className="min-h-[34px] rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
