"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { engine, PRESETS } from "@/lib/v9/audio-engine";
import { getSupabase } from "@/lib/supabase/client";
import { uid } from "@/lib/constants";

function createRoomCode(): string {
  return `UB${uid("")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase()}`;
}

function createReactionItem(
  sender: string,
  emoji: string,
  noteText?: string,
): ReactionItem {
  return {
    id: uid("sig"),
    sender,
    emoji,
    ...(noteText?.trim() ? { note: noteText.trim().slice(0, 100) } : {}),
    at: Date.now(),
  };
}

interface ReactionItem {
  id: string;
  sender: string;
  emoji: string;
  note?: string;
  at: number;
}

const CYCLE_MS = 30 * 60 * 1000; // 25m focus + 5m break deterministic global clock
const FOCUS_MS = 25 * 60 * 1000;

export function computeCoFocusPhase(nowMs: number): {
  phase: "focus" | "break";
  remainingSec: number;
  cycleProgressPct: number;
} {
  const offset = ((nowMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  if (offset < FOCUS_MS) {
    const rem = Math.ceil((FOCUS_MS - offset) / 1000);
    return {
      phase: "focus",
      remainingSec: rem,
      cycleProgressPct: Math.round((offset / FOCUS_MS) * 100),
    };
  }
  const breakOffset = offset - FOCUS_MS;
  const rem = Math.ceil((CYCLE_MS - offset) / 1000);
  return {
    phase: "break",
    remainingSec: rem,
    cycleProgressPct: Math.round((breakOffset / (CYCLE_MS - FOCUS_MS)) * 100),
  };
}

function formatClockSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CoFocusWidget() {
  const [joinedCode, setJoinedCode] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("cofocus");
    if (fromUrl) return fromUrl.toUpperCase().slice(0, 12);
    return window.localStorage.getItem("togtmol:cofocus:code");
  });
  const [codeInput, setCodeInput] = useState("");
  const [nickname, setNickname] = useState<string>(() => {
    if (typeof window === "undefined") return "Оюутан";
    return window.localStorage.getItem("togtmol:cofocus:nick") || "Оюутан";
  });
  const [now, setNow] = useState(() => Date.now());
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [breakNote, setBreakNote] = useState("");
  const [shareToast, setShareToast] = useState("");

  const bcRef = useRef<BroadcastChannel | null>(null);
  const supaChannelRef = useRef<{
    send: (payload: Record<string, unknown>) => Promise<unknown>;
    unsubscribe: () => Promise<unknown>;
  } | null>(null);

  useEffect(() => {
    if (!joinedCode) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [joinedCode]);

  useEffect(() => {
    if (!joinedCode || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("togtmol:cofocus:code", joinedCode);
    } catch {
      /* ignore */
    }

    // Same-origin tab sync via BroadcastChannel
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(`togtmol-cofocus-${joinedCode}`);
      bc.onmessage = (ev) => {
        const item = ev.data as ReactionItem;
        if (item?.id) {
          setReactions((prev) => [item, ...prev].slice(0, 8));
        }
      };
      bcRef.current = bc;
    }

    // Cross-device realtime via Supabase Broadcast if configured
    const client = getSupabase();
    if (client) {
      const channel = client.channel(`cofocus:${joinedCode}`);
      channel
        .on("broadcast", { event: "signal" }, (msg: { payload?: unknown }) => {
          const item = msg.payload as ReactionItem | undefined;
          if (item?.id) {
            setReactions((prev) => [item, ...prev].slice(0, 8));
          }
        })
        .subscribe();
      supaChannelRef.current =
        channel as unknown as typeof supaChannelRef.current;
    }

    return () => {
      bcRef.current?.close();
      bcRef.current = null;
      if (supaChannelRef.current) {
        void supaChannelRef.current.unsubscribe();
        supaChannelRef.current = null;
      }
    };
  }, [joinedCode]);

  const cycle = useMemo(() => computeCoFocusPhase(now), [now]);

  const joinOrCreate = (codeRaw?: string) => {
    const clean = (codeRaw || codeInput.trim() || createRoomCode())
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 12);
    if (!clean) return;
    setJoinedCode(clean);
    setCodeInput("");
  };

  const leaveRoom = () => {
    setJoinedCode(null);
    setReactions([]);
    try {
      window.localStorage.removeItem("togtmol:cofocus:code");
    } catch {
      /* ignore */
    }
  };

  const sendSignal = (emoji: string, noteText?: string) => {
    const item = createReactionItem(nickname.trim() || "Найз", emoji, noteText);
    setReactions((prev) => [item, ...prev].slice(0, 8));
    bcRef.current?.postMessage(item);
    if (supaChannelRef.current) {
      void supaChannelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: item,
      });
    }
  };

  const shareInvite = async () => {
    if (!joinedCode || typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}?cofocus=${joinedCode}#/overview`;
    const shareData = {
      title: `TOGTMOL Co-Focus · ${joinedCode}`,
      text: `Надтай хамт TOGTMOL Co-Focus өрөөнд (${joinedCode}) 25/5 хэмнэлээр хичээллэе! 📚`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      /* fallback to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareToast("Урилгын линк хуулагдлаа! ✓");
      window.setTimeout(() => setShareToast(""), 2400);
    } catch {
      setShareToast(`Өрөөний код: ${joinedCode}`);
    }
  };

  return (
    <div className="v9-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
            👥 Co-Focus хамтын өрөө
          </span>
          <h3 className="text-sm font-bold text-white">
            Найзтайгаа зэрэг төвлөрөх
          </h3>
        </div>
        {joinedCode && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-200">
            #{joinedCode}
          </span>
        )}
      </div>

      {!joinedCode ? (
        <div className="space-y-2.5">
          <p className="text-xs leading-relaxed text-slate-400">
            Өрөөний код үүсгээд найз руугаа линк явуулахад хоёр утас ижил 25/5
            фокус цаг болон орчны дуугаар зэрэг хичээллэнэ.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Код оруулах (эсвэл хоосон үлдээх)"
              maxLength={12}
              className="min-h-[42px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-base uppercase text-white placeholder:normal-case placeholder:text-slate-500 sm:text-xs"
            />
            <button
              type="button"
              onClick={() => joinOrCreate()}
              className="min-h-[42px] shrink-0 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-400"
            >
              {codeInput.trim() ? "Өрөөнд орох" : "✨ Шинэ өрөө нээх"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Synchronized Phase & Countdown */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {cycle.phase === "focus"
                  ? "🔥 Нийтийн төвлөрөл (25м)"
                  : "☕ Завсарлага · Чөлөөт яриа (5м)"}
              </div>
              <div className="font-mono text-2xl font-extrabold text-white">
                {formatClockSec(cycle.remainingSec)}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const cafe = PRESETS[0];
                  if (cafe) engine.applyPreset(cafe.id);
                }}
                className="min-h-[36px] rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10"
                title="Хамтын орчны дуу асаах"
              >
                🌧️ Орчны дуу
              </button>
              <button
                type="button"
                onClick={() => void shareInvite()}
                className="min-h-[36px] rounded-xl bg-indigo-500/25 px-3 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/35"
              >
                🔗 Урих
              </button>
              <button
                type="button"
                onClick={leaveRoom}
                className="min-h-[36px] rounded-xl border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:bg-white/10"
              >
                Гарах
              </button>
            </div>
          </div>

          {shareToast && (
            <p className="text-xs font-medium text-emerald-300">{shareToast}</p>
          )}

          {/* Silent Emoji Signals */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              type="text"
              aria-label="Таны нэр"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                try {
                  window.localStorage.setItem(
                    "togtmol:cofocus:nick",
                    e.target.value,
                  );
                } catch {
                  /* ignore */
                }
              }}
              maxLength={18}
              className="min-h-[36px] w-28 rounded-xl border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-slate-200"
            />
            <div className="flex gap-1.5">
              {["🔥", "☕", "👏", "📚", "💪"].map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => sendSignal(em)}
                  aria-label={`Дохио илгээх ${em}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-base transition hover:bg-white/15 active:scale-95"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Break-only mini message box (distraction-free during focus!) */}
          {cycle.phase === "break" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!breakNote.trim()) return;
                sendSignal("💬", breakNote);
                setBreakNote("");
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={breakNote}
                onChange={(e) => setBreakNote(e.target.value)}
                placeholder="Завсарлагын богино зурвас бичих..."
                maxLength={100}
                className="min-h-[38px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-base text-white sm:text-xs"
              />
              <button
                type="submit"
                className="min-h-[38px] rounded-xl bg-emerald-500 px-3 text-xs font-bold text-slate-950"
              >
                Илгээх
              </button>
            </form>
          ) : (
            <p className="text-[11px] text-slate-400">
              🤫 Фокус үед анхаарал сарниулахгүйн тулд зөвхөн эможи дохио
              ажиллана. Завсарлагаар зурвас нээгдэнэ.
            </p>
          )}

          {reactions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {reactions.slice(0, 5).map((r) => (
                <span
                  key={r.id}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-200"
                >
                  {r.emoji} <strong>{r.sender}</strong>
                  {r.note ? `: ${r.note}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
