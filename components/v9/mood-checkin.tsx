"use client";

import { useMemo } from "react";
import { useStudy } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { engine, PRESETS } from "@/lib/v9/audio-engine";
import { triggerEmojiBurst } from "./emoji-burst";
import type { BondookMood } from "./bondook-widget";

export interface DailyEmotionOption {
  id: string;
  emoji: string;
  label: string;
  burst: string[];
  bondookMood: BondookMood;
  reply: string;
  suggestedFocusMin: number;
  suggestedBreakMin: number;
  presetHint: string;
  actionLabel: string;
}

export const DAILY_EMOTIONS: DailyEmotionOption[] = [
  {
    id: "inspired",
    emoji: "🥰",
    label: "Урамтай",
    burst: ["🥰", "🌸", "💖", "✨", "🎉"],
    bondookMood: "love",
    reply:
      "Ямар гоё вэ! 🥰 Энэ дулаахан эрч хүчээрээ өнөөдөр хамгийн чухал сэдвээ барьж авъя!",
    suggestedFocusMin: 35,
    suggestedBreakMin: 7,
    presetHint: "sakura",
    actionLabel: "🌸 35/7 урамтай хэмнэл сонгох",
  },
  {
    id: "calm",
    emoji: "🌸",
    label: "Тайван",
    burst: ["🌸", "🍃", "🍵", "✨", "🕊️"],
    bondookMood: "happy",
    reply:
      "Тайван сэтгэл хамгийн гүн тогтоодог шүү 🌸 Тогтуун 25 минутаар эхэлцгээе.",
    suggestedFocusMin: 25,
    suggestedBreakMin: 5,
    presetHint: "forest",
    actionLabel: "🍵 25/5 тайван хэмнэл сонгох",
  },
  {
    id: "onfire",
    emoji: "🔥",
    label: "Эрч хүчтэй",
    burst: ["🔥", "🚀", "⚡", "🏆", "✨"],
    bondookMood: "party",
    reply:
      "Хөөх, гал асч байна шүү дээ! 🔥 Өнөөдөр 50 минутын гүн суултаар том ард нь гаръя!",
    suggestedFocusMin: 50,
    suggestedBreakMin: 10,
    presetHint: "night",
    actionLabel: "🚀 50/10 гүн фокус тохируулах",
  },
  {
    id: "tired",
    emoji: "🥹",
    label: "Ядарсан",
    burst: ["🫂", "💛", "🕯️", "🍵", "🌙"],
    bondookMood: "sleep",
    reply:
      "Өнөөдөр их хичээсэн байна шүү дээ, нааш ир тэвэрье 🫂 Хүчлэлгүй 15-хан минут зөөлөн хараад амарцгаая.",
    suggestedFocusMin: 15,
    suggestedBreakMin: 5,
    presetHint: "rain",
    actionLabel: "🕯️ 15/5 зөөлөн хэмнэл + Бороо",
  },
  {
    id: "sleepy",
    emoji: "☕",
    label: "Нойрмог",
    burst: ["☕", "🧋", "🌤️", "✨", "🐾"],
    bondookMood: "think",
    reply:
      "Бүлээн ус эсвэл цай балгаад мөрөө зөөлөн эргүүлээрэй ☕ 20 минутын сэргээх фокус хийе!",
    suggestedFocusMin: 20,
    suggestedBreakMin: 5,
    presetHint: "cafe",
    actionLabel: "☕ 20/5 сэргээх кафе хэмнэл",
  },
  {
    id: "blue",
    emoji: "🌧️",
    label: "Тавгүй",
    burst: ["🌈", "💜", "🫂", "🍀", "✨"],
    bondookMood: "love",
    reply:
      "Зарим өдөр ийм байх огтхон ч буруу биш ээ 💜 Өөрийгөө шүүмжлэлгүй ганцхан жижиг 10 минут л хамт сууя.",
    suggestedFocusMin: 10,
    suggestedBreakMin: 5,
    presetHint: "rain",
    actionLabel: "💜 10/5 энэрэнгүй жижиг алхам",
  },
];

export function MoodCheckinCard({
  onSelectBondookMood,
  onBondookMessage,
}: {
  onSelectBondookMood?: (m: BondookMood) => void;
  onBondookMessage?: (msg: string) => void;
}) {
  const { data, store, today, run } = useStudy();

  const moodHistory = useMemo(() => {
    const raw = data.settings.extras.dailyMoodMap;
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, string>)
      : {};
  }, [data.settings.extras.dailyMoodMap]);

  const todayMoodId = moodHistory[today] ?? null;
  const activeOption = DAILY_EMOTIONS.find((x) => x.id === todayMoodId) ?? null;

  const chooseEmotion = async (opt: DailyEmotionOption) => {
    triggerEmojiBurst(opt.burst);
    onSelectBondookMood?.(opt.bondookMood);
    onBondookMessage?.(opt.reply);
    await run(async () => {
      await store.mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: {
            ...d.settings.extras,
            dailyMoodMap: {
              ...(d.settings.extras.dailyMoodMap &&
              typeof d.settings.extras.dailyMoodMap === "object"
                ? (d.settings.extras.dailyMoodMap as Record<string, string>)
                : {}),
              [today]: opt.id,
            },
          },
        },
      }));
    });
  };

  const applyCarePace = async (opt: DailyEmotionOption) => {
    triggerEmojiBurst(["✨", opt.emoji, "🐾"]);
    const matchingPreset = PRESETS.find((p) =>
      p.id.toLowerCase().includes(opt.presetHint),
    );
    if (matchingPreset) {
      engine.applyPreset(matchingPreset.id);
    }
    await run(async () => {
      await store.mutate(
        actions.settings({
          focusMinutes: opt.suggestedFocusMin,
          shortBreakMinutes: opt.suggestedBreakMin,
        }),
      );
    }, `${opt.emoji} ${opt.suggestedFocusMin}/${opt.suggestedBreakMin} мин хэмнэл тохирууллаа!`);
  };

  return (
    <section className="glass rounded-3xl p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-pink-300/90">
            🌸 Сэтгэл санааны булан
          </span>
          <h3 className="text-[13.5px] font-bold text-white">
            Өнөөдөр та ямархуу мэдрэмжтэй байна вэ?
          </h3>
        </div>
        {activeOption && (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-pink-200">
            {activeOption.emoji} {activeOption.label}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {DAILY_EMOTIONS.map((opt) => {
          const selected = todayMoodId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => void chooseEmotion(opt)}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-2 text-center transition-all active:scale-95 ${
                selected
                  ? "bg-pink-500/25 text-white ring-1 ring-pink-300/60 shadow-lg shadow-pink-500/15"
                  : "bg-white/[0.04] text-white/75 ring-1 ring-white/10 hover:scale-[1.04] hover:bg-white/10"
              }`}
            >
              <span className="text-xl leading-none">{opt.emoji}</span>
              <span className="text-[10.5px] font-semibold leading-tight">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {activeOption && (
        <div className="anim-pop mt-3 flex flex-col justify-between gap-2 rounded-2xl border border-pink-300/20 bg-pink-950/20 p-3 text-xs sm:flex-row sm:items-center">
          <p className="leading-relaxed text-pink-100/95">
            {activeOption.reply}
          </p>
          <button
            type="button"
            onClick={() => void applyCarePace(activeOption)}
            className="min-h-[36px] shrink-0 rounded-xl bg-pink-400/25 px-3 py-1.5 text-[11.5px] font-bold text-pink-100 ring-1 ring-pink-300/40 transition hover:bg-pink-400/35"
          >
            {activeOption.actionLabel}
          </button>
        </div>
      )}
    </section>
  );
}
