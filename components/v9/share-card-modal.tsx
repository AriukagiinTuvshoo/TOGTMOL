"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/common";
import { useStudy } from "@/hooks/use-study";
import { currentStreak, shiftDate } from "@/lib/calculations/dates";
import { fmtMnDuration, levelForXp } from "@/lib/v9/focus";
import { resolveV9RoomId, roomById } from "@/lib/v9/rooms";

export function ShareCardModal({ onClose }: { onClose: () => void }) {
  const { data, index, today } = useStudy();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("");
  const room = roomById(resolveV9RoomId(data.settings.world));

  const stats = useMemo(() => {
    const activeSessions = data.sessions.filter((s) => !s.deletedAt);
    const totalXp = activeSessions.reduce((acc, s) => {
      const base = Math.floor(s.durationSec / 60) * 2;
      return acc + base + (s.durationSec >= 1200 ? 15 : 5);
    }, 0);
    const level = levelForXp(totalXp);

    const last7: { label: string; sec: number }[] = [];
    let weekSec = 0;
    for (let i = 6; i >= 0; i -= 1) {
      const d = shiftDate(today, -i);
      const sec = index.days.get(d)?.seconds ?? 0;
      weekSec += sec;
      last7.push({ label: d.slice(5), sec });
    }

    const reviewCount = data.knowledge.filter(
      (r) => r.kind === "review" && !r.deletedAt,
    ).length;

    return {
      level,
      totalXp,
      weekSec,
      last7,
      streak: currentStreak(new Set(index.sortedDates), today),
      reviewCount,
    };
  }, [data.knowledge, data.sessions, index.days, index.sortedDates, today]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 720;
    const H = 900;
    canvas.width = W;
    canvas.height = H;

    // Deep atmospheric gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#090d1a");
    grad.addColorStop(0.55, "#151c36");
    grad.addColorStop(1, "#0b1324");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle accent glow
    const glow = ctx.createRadialGradient(W * 0.8, 140, 20, W * 0.8, 140, 340);
    glow.addColorStop(0, `${room.accent}55`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Outer glass frame
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // Brand header
    ctx.fillStyle = room.accent;
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("🐾 TOGTMOL · STUDY OS", 72, 96);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${today} · ${room.nameMn}`, 72, 126);

    // Hero weekly focus figure
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText("7 хоногийн гүн төвлөрөл", 72, 205);

    ctx.fillStyle = room.accent;
    ctx.font = "800 66px system-ui, -apple-system, sans-serif";
    ctx.fillText(fmtMnDuration(stats.weekSec), 72, 282);

    // 3 Stat boxes
    const boxes = [
      { label: "Түвшин", val: `Lv.${stats.level.level}` },
      { label: "Тууштай өдөр", val: `🔥 ${stats.streak} өдөр` },
      { label: "Давтсан карт", val: `🗂️ ${stats.reviewCount}` },
    ];
    boxes.forEach((b, idx) => {
      const bx = 72 + idx * 196;
      const by = 330;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(bx, by, 180, 108);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "15px system-ui, -apple-system, sans-serif";
      ctx.fillText(b.label, bx + 18, by + 36);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
      ctx.fillText(b.val, bx + 18, by + 78);
    });

    // 7-day bar chart
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.fillText("Сүүлийн 7 өдрийн хэмнэл", 72, 498);

    const maxSec = Math.max(1800, ...stats.last7.map((d) => d.sec));
    stats.last7.forEach((d, idx) => {
      const x = 76 + idx * 82;
      const baseY = 720;
      const maxH = 180;
      const barH = Math.max(10, Math.round((d.sec / maxSec) * maxH));
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, baseY - maxH, 52, maxH);

      ctx.fillStyle = d.sec > 0 ? room.accent : "rgba(255,255,255,0.18)";
      ctx.fillRect(x, baseY - barH, 52, barH);

      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "13px monospace";
      ctx.fillText(d.label, x + 4, baseY + 26);
    });

    // Footer quote
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "italic 16px system-ui, -apple-system, sans-serif";
    ctx.fillText("“Өдөр бүрийн жижиг төвлөрөл том үр дүн бүтээнэ.”", 72, 820);
  }, [room.accent, room.nameMn, stats, today]);

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `togtmol-study-${today}.png`;
    a.click();
    setStatus("PNG зураг татагдлаа! ✓");
  };

  const shareMobile = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (blob && navigator.share) {
        const file = new File([blob], `togtmol-${today}.png`, {
          type: "image/png",
        });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Миний 7 хоногийн суралцах тайлан · TOGTMOL",
            text: `Энэ 7 хоногт ${fmtMnDuration(stats.weekSec)} төвлөрч сурлаа! 🔥`,
            files: [file],
          });
          setStatus("Амжилттай хуваалцлаа! 🎉");
          return;
        }
      }
    } catch {
      /* fallback to download */
    }
    downloadCard();
  };

  return (
    <Modal title="📸 7 хоногийн суралцах карт хуваалцах" onClose={onClose}>
      <div className="space-y-3 text-center">
        <div className="mx-auto max-w-[300px] overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
          <canvas
            ref={canvasRef}
            aria-label="7 хоногийн суралцах инфографик карт"
            className="h-auto w-full block"
          />
        </div>

        {status && (
          <p className="text-xs font-semibold text-emerald-300">{status}</p>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void shareMobile()}
            className="min-h-[46px] rounded-2xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-400"
          >
            📲 Story / Утсаар хуваалцах
          </button>
          <button
            type="button"
            onClick={downloadCard}
            className="min-h-[46px] rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-white/10"
          >
            ⬇️ PNG зураг татах
          </button>
        </div>
      </div>
    </Modal>
  );
}
