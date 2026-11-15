"use client";

import { useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { triggerEmojiBurst } from "./emoji-burst";

const STUDY_TRACKS = [
  {
    id: "uni",
    emoji: "🎓",
    label: "Их сургууль & Судалгаа",
    subjects: [
      ["Мэргэжлийн хичээл", "#818cf8"],
      ["Семинар & Бие даалт", "#34d399"],
    ],
    focus: 40,
    shortBreak: 8,
  },
  {
    id: "exam",
    emoji: "📝",
    label: "ЕЭШ / Түвшин тогтоох шалгалт",
    subjects: [
      ["Математик / Бодлого", "#f59e0b"],
      ["Тест & Давтлага", "#f472b6"],
    ],
    focus: 45,
    shortBreak: 10,
  },
  {
    id: "lang",
    emoji: "🌏",
    label: "Гадаад хэл (EN · JA · KR)",
    subjects: [
      ["Үгийн сан & Ханз", "#a78bfa"],
      ["Сонсгол & Яриа", "#38bdf8"],
    ],
    focus: 25,
    shortBreak: 5,
  },
  {
    id: "code",
    emoji: "💻",
    label: "Код & Ур чадвар",
    subjects: [
      ["Программчлал & Төсөл", "#2dd4bf"],
      ["Алгоритм & Тэмдэглэл", "#fb7185"],
    ],
    focus: 50,
    shortBreak: 10,
  },
] as const;

export function CozyOnboardingBanner() {
  const { data, store, run } = useStudy();
  const [openSetup, setOpenSetup] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string>("uni");
  const [customFocus, setCustomFocus] = useState<number>(25);

  const dismissed = Boolean(data.settings.extras.onboardingDoneV12);
  const hasAnySessionsOrSubjects =
    data.sessions.some((s) => !s.deletedAt) ||
    data.subjects.filter((s) => !s.deletedAt).length > 1;

  if (dismissed || hasAnySessionsOrSubjects) return null;

  const dismiss = async () => {
    await run(async () => {
      await store.mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: { ...d.settings.extras, onboardingDoneV12: true },
        },
      }));
    });
  };

  const applySetup = async () => {
    const track =
      STUDY_TRACKS.find((t) => t.id === selectedTrack) ?? STUDY_TRACKS[0];
    triggerEmojiBurst(["🎉", "🌸", "🐾", "✨", track.emoji]);
    await run(async () => {
      await store.mutate((d) => {
        let next = d;
        const existingNames = new Set(
          next.subjects
            .filter((s) => !s.deletedAt)
            .map((s) => s.name.toLocaleLowerCase()),
        );
        for (const [name, color] of track.subjects) {
          if (!existingNames.has(name.toLocaleLowerCase())) {
            next = actions.addSubject(name, color)(next);
          }
        }
        next = actions.settings({
          focusMinutes: customFocus,
          shortBreakMinutes: Math.max(5, Math.round(customFocus / 5)),
        })(next);
        return {
          ...next,
          settings: {
            ...next.settings,
            updatedAt: Date.now(),
            extras: {
              ...next.settings.extras,
              onboardingDoneV12: true,
            },
          },
        };
      });
    }, "Таны суралцах өрөө бэлэн боллоо! Амжилт хүсье 🐾✨");
  };

  return (
    <section className="glass rounded-3xl border border-indigo-400/30 bg-indigo-950/30 p-4">
      {!openSetup ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🐾</span>
            <div>
              <div className="text-xs font-bold text-indigo-200">
                Тавтай морил! Өөрийн суралцах булангаа 30 секундэд тохируулах
                уу? ✨
              </div>
              <div className="text-[11px] text-slate-300">
                Суралцах чиглэл болон дуртай цагийн хэмнэлээ сонгоход Бондоок
                бүгдийг бэлдэж өгнө.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenSetup(true)}
              className="min-h-[38px] rounded-xl bg-indigo-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400"
            >
              ✨ Эхлүүлэх (30 сек)
            </button>
            <button
              type="button"
              onClick={() => void dismiss()}
              className="min-h-[38px] rounded-xl px-2.5 py-1.5 text-xs text-slate-400 hover:bg-white/10"
            >
              Дараа
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              ✨ Юунд зориулж төвлөрч суралцах вэ?
            </h3>
            <button
              type="button"
              onClick={() => void dismiss()}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Хаах
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STUDY_TRACKS.map((tr) => {
              const active = selectedTrack === tr.id;
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => {
                    setSelectedTrack(tr.id);
                    setCustomFocus(tr.focus);
                  }}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-indigo-400 bg-indigo-500/25 text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span className="text-2xl">{tr.emoji}</span>
                  <div>
                    <div className="text-xs font-bold">{tr.label}</div>
                    <div className="text-[10.5px] opacity-70">
                      Санал болгох: {tr.focus} мин
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/25 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
              <span>⏱ Нэг удаагийн фокус хугацаа:</span>
              {[15, 25, 35, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCustomFocus(m)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                    customFocus === m
                      ? "bg-amber-400 text-slate-950"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {m}м
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void applySetup()}
              className="min-h-[40px] rounded-xl bg-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-300"
            >
              🚀 Миний өрөөг бэлдэх
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
