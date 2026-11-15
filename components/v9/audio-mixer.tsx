"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CloudRain,
  Waves,
  Trees,
  Coffee,
  Flame,
  Wind,
  AudioLines,
  AudioWaveform,
  WavesLadder,
  Orbit,
  Brain,
  Disc3,
  Cat,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Headphones,
  ChevronDown,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  CHANNELS,
  PRESETS,
  engine,
  type ChannelId,
} from "@/lib/v9/audio-engine";
import { BondookCard } from "./bondook-widget";

const ICONS: Record<string, LucideIcon> = {
  "cloud-rain": CloudRain,
  waves: Waves,
  trees: Trees,
  coffee: Coffee,
  flame: Flame,
  wind: Wind,
  "audio-lines": AudioLines,
  "audio-waveform": AudioWaveform,
  "waves-ladder": WavesLadder,
  orbit: Orbit,
  brain: Brain,
  disc: Disc3,
  cat: Cat,
};

export function useSoundEngine() {
  useEffect(() => {
    engine.hydrateFromStorage();
  }, []);
  return useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );
}

export function AudioMixer({ accent }: { accent: string }) {
  const { mix, master, muted, activePreset, activeCount } = useSoundEngine();
  const [expanded, setExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent)
    ) {
      return;
    }
    const cv = canvasRef.current;
    if (!cv) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = cv.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const W = cv.width;
      const H = cv.height;
      ctx.clearRect(0, 0, W, H);
      const spec = engine.spectrum(40);
      const bw = W / 40;
      if (activeCount > 0) {
        spec.forEach((v, i) => {
          const fakeWave =
            v > 0.01
              ? v
              : 0.14 + Math.abs(Math.sin(Date.now() / 360 + i * 0.45)) * 0.42;
          const h = Math.max(3, fakeWave * H);
          const g = ctx.createLinearGradient(0, H - h, 0, H);
          g.addColorStop(0, accent);
          g.addColorStop(1, `${accent}33`);
          ctx.fillStyle = g;
          const x = i * bw + 1;
          if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, H - h, bw - 2, h, 3);
            ctx.fill();
          } else {
            ctx.fillRect(x, H - h, bw - 2, h);
          }
        });
      } else {
        ctx.fillStyle = "rgba(255,255,255,.16)";
        const t = Date.now() / 900;
        for (let i = 0; i < 40; i++) {
          const h = 3 + Math.sin(t + i * 0.4) * 2;
          const x = i * bw + 1;
          if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, H / 2 - h / 2, bw - 2, h, 2);
            ctx.fill();
          } else {
            ctx.fillRect(x, H / 2 - h / 2, bw - 2, h);
          }
        }
      }
      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, [accent, activeCount]);

  const sliderStyle = (v: number, color: string) =>
    ({
      "--p": `${v * 100}%`,
      "--fill": color,
    }) as React.CSSProperties;

  return (
    <div className="glass rounded-3xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-10 w-10 place-items-center rounded-2xl"
            style={{
              background: `${accent}22`,
              border: `1px solid ${accent}44`,
            }}
          >
            <AudioWaveform size={20} style={{ color: accent }} />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-white">
              Дууны систем
            </h3>
            <p className="text-[11px] text-white/55">
              {activeCount === 0
                ? "13 суваг бэлэн — пресет сонго"
                : `${activeCount} суваг тоглож байна`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => engine.setMuted(!muted)}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/75 ring-1 ring-white/10 transition hover:bg-white/15"
            title={muted ? "Амбиент дуу нээх" : "Амбиент дуу хаах"}
            aria-label={muted ? "Амбиент дуу нээх" : "Амбиент дуу хаах"}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <button
            type="button"
            onClick={() => engine.stopAll()}
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/75 ring-1 ring-white/10 transition hover:bg-red-500/30 hover:text-red-200"
            title="Бүх амбиент сувгийг зогсоох"
            aria-label="Бүх амбиент сувгийг зогсоох"
          >
            <Square size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-black/40 p-2 ring-1 ring-white/10">
        <canvas
          ref={canvasRef}
          width={560}
          height={64}
          className="h-16 w-full"
        />
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
        <Volume2 size={16} className="shrink-0 text-white/60" />
        <input
          aria-label="Амбиент ерөнхий түвшин"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : master}
          onChange={(e) => engine.setMaster(Number(e.target.value))}
          className="v9-range w-full"
          style={sliderStyle(muted ? 0 : master, accent)}
        />
        <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-white/70">
          {Math.round((muted ? 0 : master) * 100)}%
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/50">
          <Sparkles size={12} /> Бэлэн орчин
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => engine.applyPreset(p.id)}
              title={p.desc}
              className={`group rounded-2xl px-2.5 py-2 text-left ring-1 transition-all hover:scale-[1.02] ${
                activePreset === p.id
                  ? "bg-white/15 ring-white/30"
                  : "bg-white/5 ring-white/10 hover:bg-white/10"
              }`}
              style={
                activePreset === p.id
                  ? {
                      background: `${accent}24`,
                      borderColor: `${accent}55`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base">{p.emoji}</span>
                <span className="truncate text-[12px] font-bold text-white">
                  {p.nameMn}
                </span>
                {activePreset === p.id && (
                  <Play
                    size={11}
                    style={{ color: accent }}
                    className="ml-auto shrink-0"
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-2.5 text-[12px] font-bold text-white/75 ring-1 ring-white/10 transition hover:bg-white/10"
      >
        <SlidersHorizontal size={14} />
        {expanded ? "Микшер хураах" : "Микшер нээх — 13 суваг"}
        <ChevronDown
          size={14}
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="anim-pop mt-2.5 space-y-1.5">
          {CHANNELS.map((ch) => {
            const ChIcon = ICONS[ch.icon] ?? AudioLines;
            const v = mix[ch.id as ChannelId] ?? 0;
            const on = v > 0.01;
            return (
              <div
                key={ch.id}
                className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-2 ring-1 transition ${
                  on
                    ? "bg-white/8 ring-white/15"
                    : "bg-white/[.03] ring-white/5"
                }`}
              >
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: on ? `${ch.color}26` : "rgba(255,255,255,.05)",
                    border: `1px solid ${on ? `${ch.color}55` : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  <ChIcon
                    size={15}
                    style={{ color: on ? ch.color : "rgba(255,255,255,.4)" }}
                  />
                </div>
                <div className="w-[86px] shrink-0">
                  <div className="truncate text-[12px] font-bold text-white">
                    {ch.nameMn}
                  </div>
                  <div className="truncate text-[10px] text-white/45">
                    {ch.desc}
                  </div>
                </div>
                <input
                  aria-label={`${ch.nameMn} сувгийн түвшин`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={v}
                  onChange={(e) =>
                    engine.setChannel(ch.id, Number(e.target.value))
                  }
                  className="v9-range w-full"
                  style={sliderStyle(v, ch.color)}
                />
                <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-white/60">
                  {Math.round(v * 100)}
                </span>
              </div>
            );
          })}
          <div className="flex items-start gap-2 rounded-2xl bg-violet-400/10 p-3 text-[11px] leading-relaxed text-violet-200/90 ring-1 ring-violet-400/25">
            <Headphones size={15} className="mt-0.5 shrink-0" />
            <span>
              <b>Хоёр чихний долгион (Binaural α 10Hz)</b> нь чихэвчтэй үед
              хамгийн үр дүнтэй. Альфа долгион нь тайван төвлөрлийг дэмждэг нь
              судалгаагаар батлагдсан.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SoundStudioView({ accent }: { accent: string }) {
  return (
    <div className="grid gap-3.5 lg:grid-cols-2">
      <AudioMixer accent={accent} />
      <div className="space-y-3.5">
        <div className="glass rounded-3xl p-5">
          <h3 className="font-display text-[16px] font-bold text-white">
            Дууны шинжлэх ухаан 🎧
          </h3>
          <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-white/70">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <b className="text-white">Ягаан/бор чимээ</b> — тархины
              “санамсаргүй яриа” мэдрэмжийг дарж, унших ойлголтыг 15–25%
              нэмэгдүүлдэг.
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <b className="text-white">Бороо + кафе (~70dB)</b> — судалгаагаар
              дунд зэргийн орчны чимээ бүтээлч сэтгэлгээг идэвхжүүлдэг.
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <b className="text-white">Альфа бинаурал 10Hz</b> — чихэвчтэй
              сонсоход тайван сэргэг байдал (relaxed alertness) нэмэгддэг.
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <b className="text-white">Муурны хурхираа 25Hz</b> — бага
              давтамжийн чичиргээ стрессийн кортизолыг бууруулдаг.
            </div>
          </div>
        </div>
        <BondookCard
          mood="love"
          compact
          message="Дуртай хослолоо хадгал — тархи чинь тэр дууг 'фокусын дохио' гэж сурна. YouTube болон өөрийн аудио файлаа доод хөгжмийн самбараас зэрэг ашиглаарай!"
        />
      </div>
    </div>
  );
}
