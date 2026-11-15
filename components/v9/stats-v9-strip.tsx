"use client";

import { useMemo, useRef, useState } from "react";
import {
  Award,
  TrendingUp,
  Download,
  Upload,
  ShieldCheck,
  Database,
} from "lucide-react";
import { useStudy } from "@/hooks/use-study";
import { downloadJson } from "@/components/ui/common";
import { shiftDate } from "@/lib/calculations/dates";
import { fmtMnDuration, levelForXp } from "@/lib/v9/focus";
import { resolveV9RoomId, roomById } from "@/lib/v9/rooms";

export function StatsV9Banner() {
  const { data, index, today } = useStudy();
  const room = roomById(resolveV9RoomId(data.settings.world));
  const accent = room.accent;

  const summary = useMemo(() => {
    const activeSessions = data.sessions.filter((s) => !s.deletedAt);
    const totalXp = activeSessions.reduce((acc, s) => {
      const base = Math.floor(s.durationSec / 60) * 2;
      return acc + base + (s.durationSec >= 1200 ? 15 : 5);
    }, 0);
    const level = levelForXp(totalXp);

    const days: { date: string; sec: number }[] = [];
    for (let i = 55; i >= 0; i--) {
      const key = shiftDate(today, -i);
      const sec = index.days.get(key)?.seconds ?? 0;
      days.push({ date: key, sec });
    }
    return {
      totalXp,
      level,
      days,
      totalSec: index.totalSeconds,
      sessionCount: activeSessions.length,
    };
  }, [data.sessions, index.days, index.totalSeconds, today]);

  const heat = (sec: number) =>
    sec === 0
      ? "heat-0"
      : sec < 1500
        ? "heat-1"
        : sec < 3600
          ? "heat-2"
          : sec < 7200
            ? "heat-3"
            : "heat-4";

  return (
    <div className="space-y-3">
      <div className="glass overflow-hidden rounded-3xl p-4">
        <div className="flex items-center gap-3.5">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-xl font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}66)`,
              boxShadow: `0 6px 24px ${accent}55`,
            }}
          >
            {summary.level.level}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Award size={15} style={{ color: accent }} />
              <span className="font-display text-[14px] font-bold text-white">
                Түвшин {summary.level.level} · {summary.level.title}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(summary.level.into / summary.level.needed) * 100}%`,
                  background: `linear-gradient(90deg, ${accent}, #fff)`,
                }}
              />
            </div>
            <div className="mt-1 text-[11px] text-white/55">
              {summary.totalXp} XP нийт · дараагийн түвшин хүртэл{" "}
              {summary.level.needed - summary.level.into} XP
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} style={{ color: accent }} />
            <span className="text-[13px] font-bold text-white">
              Идэвхийн зураглал — 8 долоо хоног
            </span>
          </div>
          <span className="text-[11px] text-white/50">
            Нийт {fmtMnDuration(summary.totalSec)} · {summary.sessionCount} сесс
          </span>
        </div>
        <div className="grid grid-cols-[repeat(8,minmax(0,1fr))] gap-1.5 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
          {summary.days.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${fmtMnDuration(d.sec)}`}
              className={`aspect-square rounded-[6px] ${heat(d.sec)} transition hover:scale-110`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/45">
          <span>Бага</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-2.5 w-2.5 rounded-[4px] heat-${i}`} />
          ))}
          <span>Их</span>
        </div>
      </div>
    </div>
  );
}

export function StatsV9Backup() {
  const { data, store, run, today } = useStudy();
  const room = roomById(resolveV9RoomId(data.settings.world));
  const accent = room.accent;

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4500);
  };

  const doExport = () => {
    try {
      downloadJson(store.exportData(), `togtmol-backup-${today}.json`);
      show("✅ JSON нөөц татагдлаа — аюулгүй газарт хадгалаарай.");
    } catch {
      show("❌ Нөөц бэлдэхэд алдаа гарлаа.");
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const raw = await file.text();
      const ok = await run(
        () => store.importData(raw),
        "JSON нөөцийг амжилттай нэгтгэлээ.",
      );
      if (ok) {
        show("✅ JSON нөөц амжилттай сэргээгдэж нэгтгэгдлээ.");
      } else {
        show("❌ Файл унших эсвэл JSON формат буруу байна.");
      }
    } catch {
      show("❌ Файл унших эсвэл JSON формат буруу байна.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center gap-2">
        <Database size={16} style={{ color: accent }} />
        <span className="text-[13px] font-bold text-white">
          JSON нөөц ба сэргээлт
        </span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-300">
          <ShieldCheck size={12} /> Зөвхөн таны төхөөрөмж
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={doExport}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-[12px] font-bold text-white transition hover:scale-[1.02] disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
          }}
        >
          <Download size={14} /> JSON нөөц татаж авах
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-2xl bg-white/8 px-4 py-2.5 text-[12px] font-bold text-white/80 ring-1 ring-white/12 transition hover:bg-white/15 disabled:opacity-50"
        >
          <Upload size={14} /> Нөөцөөс сэргээх
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = "";
          }}
        />
      </div>
      {msg && (
        <div className="anim-pop mt-2.5 rounded-xl bg-black/30 px-3 py-2 text-[12px] font-bold text-white/85 ring-1 ring-white/10">
          {msg}
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-white/45">
        Бүх хичээл, тэмдэглэл, FSRS/SM-2 карт, сорил, сесс, зорилгыг нэг JSON
        файл болгон татах ба өөр төхөөрөмж дээр аюулгүй нэгтгэнэ.
      </p>
    </div>
  );
}
