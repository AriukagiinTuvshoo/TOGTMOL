"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { Room } from "@/lib/v9/rooms";

const SKY_REFRESH_MS = 10 * 60 * 1000;

function computeSkyOverlay(h: number): string {
  if (h >= 5 && h < 10) {
    // Morning golden-pink dawn
    return "linear-gradient(180deg, rgba(251,191,36,0.11) 0%, rgba(244,114,182,0.06) 45%, transparent 100%)";
  }
  if (h >= 10 && h < 17) {
    // Crisp clear daylight lift
    return "linear-gradient(180deg, rgba(56,189,248,0.09) 0%, transparent 65%)";
  }
  if (h >= 17 && h < 21) {
    // Cozy sunset amber-violet
    return "linear-gradient(180deg, rgba(249,115,22,0.14) 0%, rgba(168,85,247,0.08) 55%, transparent 100%)";
  }
  // Deep starry night 21:00 - 05:00
  return "linear-gradient(180deg, rgba(2,6,23,0.42) 0%, rgba(15,23,42,0.22) 60%, rgba(2,6,23,0.35) 100%)";
}

/** Deterministic PRNG so SSR and client render identical particle coordinates. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RoomBackground = memo(function RoomBackground({
  room,
  autoDayNight = true,
}: {
  room: Room;
  autoDayNight?: boolean;
}) {
  const [skyOverlay, setSkyOverlay] = useState<string | null>(null);

  useEffect(() => {
    if (!autoDayNight) return;
    const update = () => {
      setSkyOverlay(computeSkyOverlay(new Date().getHours()));
    };
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, SKY_REFRESH_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [autoDayNight]);
  const kind =
    room.id === "rainy"
      ? "rain"
      : room.id === "space" || room.id === "night"
        ? "stars"
        : room.id === "sakura"
          ? "petals"
          : room.id === "cabin"
            ? "snow"
            : room.id === "forest"
              ? "firefly"
              : room.id === "ocean"
                ? "bubbles"
                : "dust";

  const particles = useMemo(() => {
    if (
      typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent)
    ) {
      return [];
    }
    const seed = [...room.id].reduce(
      (acc, ch) => acc * 31 + ch.charCodeAt(0),
      7,
    );
    const rnd = mulberry32(seed);
    const n = kind === "stars" ? 24 : kind === "rain" ? 22 : 14;
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      left: Number((rnd() * 100).toFixed(2)),
      top: Number((rnd() * 100).toFixed(2)),
      delay: Number((rnd() * 12).toFixed(2)),
      dur: Number((4 + rnd() * 10).toFixed(2)),
      size: Number((2 + rnd() * 4.5).toFixed(2)),
    }));
  }, [kind, room.id]);

  return (
    <div
      className="v9-room-bg pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: `linear-gradient(165deg, ${room.bg[0]}, ${room.bg[1]} 55%, ${room.bg[2]})`,
        }}
      />
      {autoDayNight && skyOverlay && (
        <div
          data-sky-overlay=""
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ background: skyOverlay }}
        />
      )}
      {room.orbs.map((o, i) => (
        <div
          key={i}
          className={`anim-${o.anim} absolute rounded-full transition-all duration-1000`}
          style={{
            background: `radial-gradient(circle, ${o.color}55, transparent 70%)`,
            left: o.x,
            top: o.y,
            width: o.size,
            height: o.size,
            filter: `blur(${o.blur})`,
            transform: "translate(-50%,-50%)",
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(0,0,0,.55) 100%)",
        }}
      />
      {particles.map((p) =>
        kind === "rain" ? (
          <div
            key={p.id}
            className="absolute top-0 w-px rounded-full"
            style={{
              left: `${p.left}%`,
              height: "60px",
              background: "linear-gradient(transparent, rgba(147,197,253,.7))",
              animation: `rainfall ${0.7 + (p.dur % 1)}s linear ${p.delay}s infinite`,
            }}
          />
        ) : kind === "stars" ? (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size / 2,
              height: p.size / 2,
              animation: `twinkle ${2 + (p.dur % 4)}s ease-in-out ${p.delay}s infinite`,
              boxShadow: "0 0 6px rgba(255,255,255,.8)",
            }}
          />
        ) : kind === "petals" ? (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: "-4%",
              width: p.size + 3,
              height: p.size + 1,
              background: "linear-gradient(135deg,#f9a8d4,#f472b6)",
              opacity: 0.8,
              animation: `snowfall ${p.dur}s linear ${p.delay}s infinite`,
            }}
          />
        ) : kind === "snow" ? (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.left}%`,
              top: "-4%",
              width: p.size,
              height: p.size,
              opacity: 0.85,
              filter: "blur(.5px)",
              animation: `snowfall ${p.dur + 4}s linear ${p.delay}s infinite`,
            }}
          />
        ) : kind === "firefly" ? (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${20 + (p.top % 70)}%`,
              width: p.size,
              height: p.size,
              background: "#bef264",
              boxShadow: "0 0 12px 3px rgba(190,242,100,.5)",
              animation: `twinkle ${3 + (p.dur % 5)}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ) : kind === "bubbles" ? (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: "105%",
              width: p.size + 2,
              height: p.size + 2,
              border: "1px solid rgba(103,232,249,.5)",
              background:
                "radial-gradient(circle at 35% 35%, rgba(255,255,255,.35), transparent)",
              animation: `snowfall ${p.dur + 6}s linear ${p.delay}s infinite reverse`,
            }}
          />
        ) : (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: 2,
              height: 2,
              opacity: 0.25,
              animation: `twinkle ${4 + (p.dur % 5)}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ),
      )}
    </div>
  );
});
