"use client";

import { useEffect, useState } from "react";

interface BurstParticle {
  id: number;
  emoji: string;
  leftPct: number;
  driftPx: number;
  durationMs: number;
  sizeRem: number;
}

type BurstListener = (emojis: string[]) => void;
const burstListeners = new Set<BurstListener>();
let nextParticleId = 1;

export function triggerEmojiBurst(
  emojis: string[] = ["✨", "🌸", "💖", "🐾", "🎉"],
) {
  burstListeners.forEach((fn) => fn(emojis));
}

export function EmojiBurstLayer() {
  const [particles, setParticles] = useState<BurstParticle[]>([]);

  useEffect(() => {
    const onBurst: BurstListener = (emojis) => {
      const count = 10;
      const batch: BurstParticle[] = Array.from({ length: count }, (_, idx) => {
        const id = nextParticleId++;
        const seed = (id * 37 + idx * 19) % 100;
        return {
          id,
          emoji: emojis[idx % emojis.length] || "✨",
          leftPct: 18 + seed * 0.64,
          driftPx: (idx % 2 === 0 ? 1 : -1) * (16 + (seed % 34)),
          durationMs: 1350 + (seed % 5) * 180,
          sizeRem: 1.25 + (idx % 3) * 0.28,
        };
      });
      setParticles((prev) => [...prev.slice(-16), ...batch]);
      window.setTimeout(() => {
        const ids = new Set(batch.map((b) => b.id));
        setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
      }, 2300);
    };

    burstListeners.add(onBurst);
    return () => {
      burstListeners.delete(onBurst);
    };
  }, []);

  if (particles.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[120] overflow-hidden"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="v12-emoji-particle absolute bottom-16 select-none"
          style={{
            left: `${p.leftPct}%`,
            fontSize: `${p.sizeRem}rem`,
            ["--drift-x" as string]: `${p.driftPx}px`,
            animationDuration: `${p.durationMs}ms`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
