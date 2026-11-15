"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Wind, Play, Square, Flower2 } from "lucide-react";
import { engine } from "@/lib/v9/audio-engine";

const PATTERNS = [
  {
    id: "478",
    name: "4-7-8 Тайвшрал",
    steps: [
      { p: "Амьсгал ав", s: 4 },
      { p: "Барь", s: 7 },
      { p: "Гарга", s: 8 },
    ],
    desc: "Стресс тайлах",
  },
  {
    id: "box",
    name: "Дөрвөлжин 4-4-4-4",
    steps: [
      { p: "Ав", s: 4 },
      { p: "Барь", s: 4 },
      { p: "Гарга", s: 4 },
      { p: "Амраах", s: 4 },
    ],
    desc: "Төвлөрөл асаах",
  },
  {
    id: "energy",
    name: "Эрч хүч 6-2-4",
    steps: [
      { p: "Гүнзгий ав", s: 6 },
      { p: "Барь", s: 2 },
      { p: "Хурдан гарга", s: 4 },
    ],
    desc: "Сэргэх",
  },
];

export function Breathing({
  accent,
  onDone,
}: {
  accent: string;
  onDone?: (cycles: number) => void;
}) {
  const [patternId, setPatternId] = useState("box");
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [left, setLeft] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [target, setTarget] = useState(3);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pattern = PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[1];
  const step = pattern.steps[stepIdx] ?? pattern.steps[0];
  const total = step.s;
  const progress = total > 0 ? 1 - left / total : 0;
  const isIn = step.p.includes("Ав") || step.p.includes("ав");

  const stop = useCallback(
    (done: boolean, completedCount?: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
      const count = completedCount ?? cycles;
      if (done && count > 0) onDone?.(count);
      setStepIdx(0);
      setLeft(0);
    },
    [cycles, onDone],
  );

  const start = useCallback(() => {
    setRunning(true);
    setCycles(0);
    setStepIdx(0);
    const first = pattern.steps[0];
    setLeft(first.s);
    if (first.p.includes("Ав") || first.p.includes("ав"))
      engine.breathTone("in");
    else engine.breathTone("out");
    let sIdx = 0;
    let l = first.s;
    let cCount = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      l -= 1;
      if (l <= 0) {
        sIdx++;
        if (sIdx >= pattern.steps.length) {
          sIdx = 0;
          cCount += 1;
          setCycles(cCount);
          if (cCount >= target) {
            engine.chime("break");
            stop(true, cCount);
            return;
          }
        }
        const ns = pattern.steps[sIdx];
        l = ns.s;
        setStepIdx(sIdx);
        if (ns.p.includes("Ав") || ns.p.includes("ав")) engine.breathTone("in");
        else engine.breathTone("out");
      }
      setLeft(l);
    }, 1000);
  }, [pattern, target, stop]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const scale = running
    ? isIn
      ? 1 + progress * 0.45
      : 1.45 - progress * 0.45
    : 1;

  return (
    <div className="glass rounded-3xl p-4 md:p-5">
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-10 w-10 place-items-center rounded-2xl"
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}44`,
          }}
        >
          <Flower2 size={20} style={{ color: accent }} />
        </div>
        <div>
          <h3 className="font-display text-[15px] font-bold text-white">
            Амьсгалын дасгал
          </h3>
          <p className="text-[11px] text-white/55">
            60 секунд = төвлөрөл сэргэнэ
          </p>
        </div>
      </div>

      {!running && (
        <div className="mt-3 space-y-1.5">
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPatternId(p.id)}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left ring-1 transition ${
                patternId === p.id
                  ? "text-white"
                  : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10"
              }`}
              style={
                patternId === p.id
                  ? {
                      background: `${accent}26`,
                      borderColor: `${accent}55`,
                    }
                  : undefined
              }
            >
              <div>
                <div className="text-[13px] font-bold">{p.name}</div>
                <div className="text-[11px] opacity-60">{p.desc}</div>
              </div>
              <Wind size={16} className="opacity-60" />
            </button>
          ))}
          <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
            <span className="text-[12px] font-bold text-white/60">Давталт</span>
            <div className="flex gap-1.5">
              {[2, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTarget(n)}
                  className={`h-8 w-8 rounded-xl text-[13px] font-bold ring-1 transition ${
                    target === n
                      ? "text-white"
                      : "bg-white/5 text-white/50 ring-white/10"
                  }`}
                  style={
                    target === n
                      ? { background: `${accent}44`, borderColor: accent }
                      : undefined
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={start}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-display text-[14px] font-bold text-white transition hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}77)`,
              boxShadow: `0 8px 28px ${accent}44`,
            }}
          >
            <Play size={16} /> Эхлэх
          </button>
        </div>
      )}

      {running && (
        <div className="anim-pop mt-2 flex flex-col items-center py-2">
          <div className="relative grid h-52 w-52 place-items-center">
            <div
              className="absolute inset-0 rounded-full opacity-25"
              style={{
                background: `radial-gradient(circle, ${accent}, transparent 70%)`,
              }}
            />
            <div
              className="absolute rounded-full border-2 transition-transform duration-1000 ease-in-out"
              style={{
                width: 190,
                height: 190,
                borderColor: `${accent}66`,
                transform: `scale(${scale})`,
              }}
            />
            <div
              className="absolute rounded-full border transition-transform duration-1000 ease-in-out"
              style={{
                width: 150,
                height: 150,
                borderColor: `${accent}44`,
                transform: `scale(${2 - scale > 0 ? scale * 0.95 : 1})`,
              }}
            />
            <div
              className="grid place-items-center rounded-full text-center transition-transform duration-1000 ease-in-out"
              style={{
                width: 118,
                height: 118,
                background: `radial-gradient(circle at 35% 30%, ${accent}, ${accent}55 75%)`,
                transform: `scale(${scale})`,
                boxShadow: `0 0 50px ${accent}77`,
              }}
            >
              <div>
                <div className="font-display text-3xl font-bold text-white">
                  {left}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/85">
                  {step.p}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: target }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: i < cycles ? 28 : 12,
                  background: i < cycles ? accent : "rgba(255,255,255,.15)",
                  boxShadow: i < cycles ? `0 0 10px ${accent}` : "none",
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-white/55">
            Цикл {Math.min(cycles + 1, target)} / {target}
          </p>
          <button
            type="button"
            onClick={() => stop(false)}
            className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-[13px] font-bold text-white/75 ring-1 ring-white/15 transition hover:bg-white/15"
          >
            <Square size={14} /> Зогсоох
          </button>
        </div>
      )}
    </div>
  );
}
