"use client";

import { useMemo } from "react";
import { useStudy } from "@/hooks/use-study";

export interface CozyRelic {
  id: string;
  emoji: string;
  nameMn: string;
  requiredHours: number;
  descMn: string;
}

export const COZY_RELICS: CozyRelic[] = [
  {
    id: "bonsai",
    emoji: "🪴",
    nameMn: "Бяцхан Бонсай",
    requiredHours: 0,
    descMn: "Анхны суралцах алхмын дурсгал",
  },
  {
    id: "matcha",
    emoji: "🍵",
    nameMn: "Халуун Матча",
    requiredHours: 1,
    descMn: "1 цаг төвлөрсний шагнал",
  },
  {
    id: "candle",
    emoji: "🕯️",
    nameMn: "Лаванда лаа",
    requiredHours: 3,
    descMn: "3 цаг төвлөрсний шагнал",
  },
  {
    id: "vinyl",
    emoji: "📻",
    nameMn: "Винил хөгжим",
    requiredHours: 8,
    descMn: "8 цаг төвлөрсний шагнал",
  },
  {
    id: "telescope",
    emoji: "🔭",
    nameMn: "Од дуран",
    requiredHours: 20,
    descMn: "20 цаг төвлөрсний шагнал",
  },
  {
    id: "trophy",
    emoji: "🏆",
    nameMn: "Алтан Бондоок",
    requiredHours: 50,
    descMn: "50 цаг гүн төвлөрсний шагнал",
  },
];

export function CozyCollectiblesCard() {
  const { data, index, store, run } = useStudy();
  const totalHours = Math.floor((index.totalSeconds || 0) / 3600);
  const autoDayNight = data.settings.extras.autoDayNight !== false;

  const displayedRelicIds = useMemo(() => {
    const raw = data.settings.extras.displayedRelics;
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : ["bonsai"];
  }, [data.settings.extras.displayedRelics]);

  const toggleRelic = async (id: string) => {
    const next = displayedRelicIds.includes(id)
      ? displayedRelicIds.filter((x) => x !== id)
      : [...displayedRelicIds, id];
    await run(async () => {
      await store.mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: {
            ...d.settings.extras,
            displayedRelics: next,
          },
        },
      }));
    });
  };

  const toggleAutoDayNight = async () => {
    await run(async () => {
      await store.mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: {
            ...d.settings.extras,
            autoDayNight: !autoDayNight,
          },
        },
      }));
    });
  };

  return (
    <section className="v9-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            🌿 Living Study Room
          </span>
          <h3 className="text-sm font-bold text-white">
            Ширээний цуглуулга ({totalHours} цаг)
          </h3>
        </div>
        <button
          type="button"
          aria-pressed={autoDayNight}
          onClick={() => void toggleAutoDayNight()}
          className={`min-h-[34px] rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
            autoDayNight
              ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
              : "border-white/10 bg-white/5 text-slate-300"
          }`}
          title="Бодит цагийн өглөө / өдөр / орой / шөнийн гэрэлтүүлэг"
        >
          {autoDayNight ? "🌗 Өдөр/Шөнө · Авто" : "🌗 Өдөр/Шөнө · Унтарсан"}
        </button>
      </div>

      {/* Active desk shelf preview */}
      {displayedRelicIds.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-950/20 px-3.5 py-2">
          <span className="text-[11px] text-amber-200/80">Миний тавиур:</span>
          <div className="flex flex-wrap gap-2 text-lg">
            {COZY_RELICS.filter((r) => displayedRelicIds.includes(r.id)).map(
              (r) => (
                <span key={r.id} title={r.nameMn}>
                  {r.emoji}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {COZY_RELICS.map((relic) => {
          const unlocked = totalHours >= relic.requiredHours;
          const active = displayedRelicIds.includes(relic.id);
          return (
            <button
              key={relic.id}
              type="button"
              disabled={!unlocked}
              onClick={() => void toggleRelic(relic.id)}
              className={`flex min-h-[60px] flex-col items-start justify-between rounded-2xl border p-2.5 text-left transition ${
                !unlocked
                  ? "cursor-not-allowed border-white/5 bg-black/20 opacity-45"
                  : active
                    ? "border-emerald-400/45 bg-emerald-500/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/10"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xl">{relic.emoji}</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {unlocked
                    ? active
                      ? "✓ Тавьсан"
                      : "Тавих"
                    : `🔒 ${relic.requiredHours}ц`}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-white">
                {relic.nameMn}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
