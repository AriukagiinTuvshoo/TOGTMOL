"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { BONDOOK_QUOTES } from "@/lib/v9/focus";
import { triggerEmojiBurst } from "./emoji-burst";

export type BondookMood =
  "happy" | "focus" | "sleep" | "party" | "think" | "love";

const moodFace: Record<BondookMood, { mouth: string; blush: boolean }> = {
  happy: { mouth: "ω", blush: true },
  focus: { mouth: "–", blush: false },
  sleep: { mouth: "o", blush: true },
  party: { mouth: "D", blush: true },
  think: { mouth: "~", blush: false },
  love: { mouth: "ω", blush: true },
};

export function BondookAvatar({
  mood,
  size = 84,
  animate = true,
}: {
  mood: BondookMood;
  size?: number;
  animate?: boolean;
}) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (mood === "sleep") return;
    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      setBlink(true);
      blinkTimeout = setTimeout(() => setBlink(false), 140);
    }, 3400);
    return () => {
      clearInterval(t);
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  }, [mood]);

  const f = moodFace[mood];
  const fur =
    mood === "sleep"
      ? "#8b7fb8"
      : mood === "party"
        ? "#fbbf24"
        : mood === "love"
          ? "#f9a8d4"
          : "#c4b5fd";
  const furDark =
    mood === "sleep"
      ? "#6d6390"
      : mood === "party"
        ? "#d97706"
        : mood === "love"
          ? "#ec4899"
          : "#8b5cf6";

  return (
    <div
      className={`relative select-none ${animate ? "anim-floaty" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <path
          d="M82 70 Q96 66 92 50 Q90 42 84 44 Q80 46 84 52 Q87 60 78 62"
          fill={furDark}
          opacity=".9"
        >
          {animate && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 80 65; 8 80 65; 0 80 65"
              dur="3s"
              repeatCount="indefinite"
            />
          )}
        </path>
        <path
          d="M22 34 L18 8 L44 24 Z"
          fill={fur}
          stroke={furDark}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M78 34 L82 8 L56 24 Z"
          fill={fur}
          stroke={furDark}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M25 28 L23 15 L37 24 Z" fill="#fda4af" opacity=".8" />
        <path d="M75 28 L77 15 L63 24 Z" fill="#fda4af" opacity=".8" />
        <ellipse
          cx="50"
          cy="62"
          rx="36"
          ry="30"
          fill={fur}
          stroke={furDark}
          strokeWidth="2"
        />
        <path
          d="M38 36 q2 6 0 10 M50 34 q2 6 0 10 M62 36 q-2 6 0 10"
          stroke={furDark}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity=".55"
        />
        <ellipse cx="50" cy="74" rx="20" ry="15" fill="#fff" opacity=".35" />
        <ellipse
          cx="32"
          cy="88"
          rx="9"
          ry="6"
          fill={fur}
          stroke={furDark}
          strokeWidth="2"
        />
        <ellipse
          cx="68"
          cy="88"
          rx="9"
          ry="6"
          fill={fur}
          stroke={furDark}
          strokeWidth="2"
        />
        {mood === "sleep" || blink ? (
          <g stroke="#3b3561" strokeWidth="3" strokeLinecap="round">
            <line x1="30" y1="58" x2="42" y2="58" />
            <line x1="58" y1="58" x2="70" y2="58" />
          </g>
        ) : mood === "happy" || mood === "love" ? (
          <g
            stroke="#3b3561"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M29 60 Q36 51 43 60" />
            <path d="M57 60 Q64 51 71 60" />
          </g>
        ) : mood === "party" ? (
          <g fill="#3b3561">
            <circle cx="36" cy="57" r="5" />
            <circle cx="64" cy="57" r="5" />
            <circle cx="38" cy="55" r="1.6" fill="#fff" />
            <circle cx="66" cy="55" r="1.6" fill="#fff" />
          </g>
        ) : (
          <g>
            <ellipse cx="36" cy="58" rx="5.5" ry="7" fill="#3b3561" />
            <ellipse cx="64" cy="58" rx="5.5" ry="7" fill="#3b3561" />
            <circle cx="38" cy="55" r="2" fill="#fff" />
            <circle cx="66" cy="55" r="2" fill="#fff" />
            {mood === "focus" && (
              <g stroke="#3b3561" strokeWidth="3" strokeLinecap="round">
                <line x1="28" y1="46" x2="44" y2="49" />
                <line x1="72" y1="46" x2="56" y2="49" />
              </g>
            )}
          </g>
        )}
        {f.blush && (
          <g fill="#f472b6" opacity=".55">
            <ellipse cx="26" cy="66" rx="6" ry="4" />
            <ellipse cx="74" cy="66" rx="6" ry="4" />
          </g>
        )}
        <text
          x="50"
          y="72"
          textAnchor="middle"
          fontSize={mood === "party" ? 13 : 11}
          fill="#3b3561"
          fontWeight="bold"
        >
          {mood === "sleep" ? "–" : f.mouth}
        </text>
        <g stroke="#fff" strokeWidth="1.4" opacity=".7" strokeLinecap="round">
          <line x1="14" y1="64" x2="26" y2="66" />
          <line x1="14" y1="71" x2="26" y2="69" />
          <line x1="86" y1="64" x2="74" y2="66" />
          <line x1="86" y1="71" x2="74" y2="69" />
        </g>
        {mood === "party" && (
          <g>
            <path
              d="M50 4 L38 32 L62 32 Z"
              fill="#f472b6"
              stroke="#be185d"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="50" cy="4" r="4" fill="#fff" />
            <circle cx="46" cy="22" r="2.4" fill="#fde047" />
            <circle cx="54" cy="26" r="2.4" fill="#67e8f9" />
          </g>
        )}
        {mood === "sleep" && (
          <g fill="#c4b5fd" fontWeight="bold">
            <text x="80" y="24" fontSize="12">
              z
            </text>
            <text x="87" y="14" fontSize="16">
              z
            </text>
            <text x="72" y="34" fontSize="9">
              z
            </text>
          </g>
        )}
        {mood === "think" && (
          <g fill="#fff" opacity=".9">
            <circle cx="82" cy="34" r="3" />
            <circle cx="88" cy="26" r="4.5" />
            <circle cx="80" cy="40" r="2" />
          </g>
        )}
      </svg>
      {mood === "party" && (
        <div className="absolute -right-1 -top-1 animate-bounce text-xl">
          🎉
        </div>
      )}
    </div>
  );
}

export function BondookCard({
  mood,
  message,
  lastReflection,
  level,
  compact = false,
  onMood,
  onOpenChat,
}: {
  mood: BondookMood;
  message?: string;
  lastReflection?: string | null;
  level?: number;
  compact?: boolean;
  onMood?: (m: BondookMood) => void;
  onOpenChat?: () => void;
}) {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [careMsg, setCareMsg] = useState<string | null>(null);
  const [hearts, setHearts] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    const saved = Number(window.localStorage.getItem("togtmol:bondook:hearts"));
    return Number.isFinite(saved) && saved > 0 ? saved : 3;
  });

  useEffect(() => {
    const t = setInterval(() => {
      setQuoteIdx((i) => (i + 1) % BONDOOK_QUOTES.length);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  const giveCare = (
    nextMood: BondookMood,
    reaction: string,
    emojis: string[],
  ) => {
    onMood?.(nextMood);
    setCareMsg(reaction);
    triggerEmojiBurst(emojis);
    setHearts((prev) => {
      const next = prev + 1;
      try {
        window.localStorage.setItem("togtmol:bondook:hearts", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    window.setTimeout(() => setCareMsg(null), 5500);
  };

  const moods: BondookMood[] = [
    "happy",
    "focus",
    "sleep",
    "party",
    "think",
    "love",
  ];
  const moodLabels: Record<BondookMood, string> = {
    happy: "😊",
    focus: "🎯",
    sleep: "😴",
    party: "🎉",
    think: "🤔",
    love: "💜",
  };

  return (
    <div className={`glass rounded-3xl p-4 ${compact ? "" : "md:p-5"}`}>
      <div className="flex items-start gap-3">
        <BondookAvatar mood={mood} size={compact ? 64 : 80} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-bold tracking-wide text-white">
              БОНДООК
            </span>
            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              ● онлайн
            </span>
            {typeof level === "number" && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/75">
                Lv. {level}
              </span>
            )}
            <span
              className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold text-pink-200"
              title="Бондоокийн дотносол"
            >
              💖 {hearts}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">
            {careMsg ?? message ?? BONDOOK_QUOTES[quoteIdx]}
          </p>
          {!compact && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  giveCare(
                    "love",
                    "Хэ-хэ, толгой илэхээр ямар дулаахан гоё юм бэ~ 🥰🐾 Хамтдаа хичээе!",
                    ["💕", "🥰", "🐾", "✨"],
                  )
                }
                className="rounded-xl bg-pink-500/15 px-2.5 py-1 text-[11px] font-semibold text-pink-100 ring-1 ring-pink-400/25 transition hover:scale-105 hover:bg-pink-500/25 active:scale-95"
              >
                👋 Илэх
              </button>
              <button
                type="button"
                onClick={() =>
                  giveCare(
                    "happy",
                    "Ам-ам! 🍪 Халуун жигнэмэг хамгийн амттай нь! Эрч хүч дүүрлээ ✨",
                    ["🍪", "😋", "💛", "✨"],
                  )
                }
                className="rounded-xl bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-400/25 transition hover:scale-105 hover:bg-amber-500/25 active:scale-95"
              >
                🍪 Жигнэмэг
              </button>
              <button
                type="button"
                onClick={() =>
                  giveCare(
                    "party",
                    "Ммм~ сүүтэй цай! 🧋🎉 Одоо хоёулаа ямар ч хичээлийг дийлнэ ээ!",
                    ["🧋", "🌸", "🎉", "💜"],
                  )
                }
                className="rounded-xl bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold text-purple-100 ring-1 ring-purple-400/25 transition hover:scale-105 hover:bg-purple-500/25 active:scale-95"
              >
                🧋 Цай өгөх
              </button>
            </div>
          )}
          {lastReflection && (
            <div className="mt-2 rounded-2xl bg-white/[.05] px-3 py-2 ring-1 ring-white/10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Сүүлчийн тэмдэглэл
              </div>
              <p className="mt-0.5 text-[12px] text-white/80">
                {lastReflection}
              </p>
            </div>
          )}
          {!compact && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {moods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMood?.(m)}
                    title={`Бондоокийн төлөв: ${m}`}
                    className={`rounded-xl px-2 py-1 text-sm transition-all hover:scale-110 ${
                      mood === m
                        ? "bg-white/20 ring-1 ring-white/30"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {moodLabels[m]}
                  </button>
                ))}
              </div>
              {onOpenChat && (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/8 px-2.5 py-1.5 text-[11px] font-bold text-white/80 ring-1 ring-white/12 transition hover:bg-white/15 hover:text-white"
                >
                  Бондооктой ярилцах <ArrowRight size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
