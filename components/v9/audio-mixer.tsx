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
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Sparkles,
  Headphones,
  ChevronDown,
  SlidersHorizontal,
  BookmarkPlus,
  Trash2,
  Music2,
  Upload,
  Link2,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { AMBIENTS } from "@/lib/music/catalog";
import { uid } from "@/lib/constants";
import { useStudy } from "@/hooks/use-study";
import {
  CHANNELS,
  PRESETS,
  engine,
  type ChannelId,
} from "@/lib/v9/audio-engine";
import {
  deck1Bridge,
  readSavedMixes,
  type Deck1BridgeState,
  type SavedAudioMix,
} from "@/lib/v9/audio-bridge";
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

export function useDeck1Bridge(): Deck1BridgeState {
  const [snap, setSnap] = useState<Deck1BridgeState>(() =>
    deck1Bridge.getState(),
  );
  useEffect(() => deck1Bridge.subscribe(setSnap), []);
  return snap;
}

export function AudioMixer({
  accent,
  defaultExpanded = false,
}: {
  accent: string;
  defaultExpanded?: boolean;
}) {
  const { mix, master, muted, activePreset, activeCount } = useSoundEngine();
  const [expanded, setExpanded] = useState(defaultExpanded);
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
                ? "Deck 2 & 3 · 13 суваг бэлэн — пресет сонго"
                : `${activeCount} суваг идэвхтэй давхарлаж байна`}
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
          <Sparkles size={12} /> Бэлэн орчны пресетүүд (11)
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
              хамгийн үр дүнтэй. Альфа долгион нь тайван төвлөрлийг дэмждэг.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SoundStudioView({ accent }: { accent: string }) {
  const { data, store } = useStudy();
  const { mix, activeCount } = useSoundEngine();
  const deck1 = useDeck1Bridge();
  const [streamUrl, setStreamUrl] = useState("");
  const [streamTitle, setStreamTitle] = useState("");
  const [mixName, setMixName] = useState("");
  const [studioNotice, setStudioNotice] = useState("");

  const savedMixes = readSavedMixes(data.settings.extras);
  const autoDuckOnBreak = Boolean(data.settings.extras.autoDuckOnBreak);
  const autoStartFocusSound = Boolean(data.settings.extras.autoStartFocusSound);

  const saveCurrentMix = async () => {
    const trimmed = mixName.trim() || `Микс #${savedMixes.length + 1}`;
    const nonZeroChannels: Partial<Record<ChannelId, number>> = {};
    CHANNELS.forEach((c) => {
      const val = mix[c.id] ?? 0;
      if (val > 0.01) nonZeroChannels[c.id] = Number(val.toFixed(2));
    });
    const entry: SavedAudioMix = {
      id: uid("mix"),
      name: trimmed.slice(0, 50),
      createdAt: Date.now(),
      deck1Selected: deck1.selected || null,
      deck1Name: deck1.name,
      channels: nonZeroChannels,
    };
    const nextList = [entry, ...savedMixes].slice(0, 20);
    await store.mutate(
      (d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: { ...d.settings.extras, savedMixes: nextList },
        },
      }),
      { reportError: false, reportBusy: false },
    );
    setMixName("");
    setStudioNotice(`"${entry.name}" миксийг хадгаллаа!`);
  };

  const loadSavedMix = (item: SavedAudioMix) => {
    engine.applyCustomMix(item.channels);
    if (item.deck1Selected) {
      deck1Bridge.getActions()?.select(item.deck1Selected);
    }
    setStudioNotice(`"${item.name}" миксийг ачааллаа.`);
  };

  const deleteSavedMix = async (id: string) => {
    const nextList = savedMixes.filter((m) => m.id !== id);
    await store.mutate(
      (d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: { ...d.settings.extras, savedMixes: nextList },
        },
      }),
      { reportError: false, reportBusy: false },
    );
  };

  const toggleExtraFlag = async (
    key: "autoDuckOnBreak" | "autoStartFocusSound",
    value: boolean,
  ) => {
    await store.mutate(
      (d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: { ...d.settings.extras, [key]: value },
        },
      }),
      { reportError: false, reportBusy: false },
    );
  };

  return (
    <div className="space-y-4">
      {studioNotice && (
        <div
          role="status"
          className="glass flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30"
        >
          <span>✨ {studioNotice}</span>
          <button
            type="button"
            onClick={() => setStudioNotice("")}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Deck 2 & 3 (13-Channel Procedural Soundscape) */}
        <div className="space-y-4 lg:col-span-7">
          <AudioMixer accent={accent} defaultExpanded />
        </div>

        {/* Right Column: Deck 1 (Music, YouTube & 80MB Local Files) + Saved Mixes + Smart Timer Sync */}
        <div className="space-y-4 lg:col-span-5">
          {/* Deck 1 Card */}
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
                  <Music2 size={19} style={{ color: accent }} />
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-white">
                    Deck 1 · Хөгжим & YouTube
                  </h3>
                  <p className="text-[11px] text-white/55">
                    {deck1.playing ? `Тоглож байна: ${deck1.name}` : deck1.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => deck1Bridge.getActions()?.setOpen(!deck1.open)}
                className="flex items-center gap-1 rounded-xl bg-white/8 px-2.5 py-1.5 text-[11px] font-semibold text-white/80 ring-1 ring-white/12 transition hover:bg-white/15"
              >
                <ExternalLink size={12} />
                {deck1.open ? "Видео хураах" : "Видео цонх"}
              </button>
            </div>

            {/* Transport Row */}
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10">
              <button
                type="button"
                onClick={() => deck1Bridge.getActions()?.next(-1)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/80 hover:bg-white/15"
                title="Өмнөх"
              >
                <SkipBack size={15} />
              </button>
              <button
                type="button"
                onClick={() => deck1Bridge.getActions()?.toggle()}
                className="grid h-10 w-10 place-items-center rounded-xl font-bold text-slate-950 transition hover:scale-105"
                style={{ background: accent }}
                title={deck1.playing ? "Түр зогсоох" : "Тоглуулах"}
              >
                {deck1.playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                type="button"
                onClick={() => deck1Bridge.getActions()?.next(1)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/80 hover:bg-white/15"
                title="Дараах"
              >
                <SkipForward size={15} />
              </button>
              <button
                type="button"
                onClick={() => deck1Bridge.getActions()?.stop()}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/80 hover:bg-red-500/25"
                title="Зогсоох"
              >
                <Square size={14} />
              </button>
              <div className="ml-1 flex flex-1 items-center gap-2">
                <Volume2 size={14} className="shrink-0 text-white/55" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={deck1.muted ? 0 : deck1.volume}
                  onChange={(e) =>
                    deck1Bridge.getActions()?.setVolume(Number(e.target.value))
                  }
                  className="v9-range w-full"
                  aria-label="Deck 1 хөгжмийн түвшин"
                />
              </div>
            </div>

            {/* Built-in Study Loops */}
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {AMBIENTS.map((a) => {
                const active = deck1.selected === `ambient:${a.id}`;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      deck1Bridge.getActions()?.select(`ambient:${a.id}`)
                    }
                    className={`rounded-xl px-2.5 py-2 text-left text-[11.5px] font-semibold ring-1 transition ${
                      active
                        ? "bg-amber-400/20 text-amber-200 ring-amber-400/50"
                        : "bg-white/5 text-white/75 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className="truncate font-bold">{a.name}</div>
                    <div className="truncate text-[10px] text-white/45">
                      {a.detail}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Add YouTube / Audio Link + 80MB File Upload */}
            <form
              className="mt-3 space-y-2 rounded-2xl bg-white/[.03] p-3 ring-1 ring-white/10"
              onSubmit={(e) => {
                e.preventDefault();
                if (!streamUrl.trim()) return;
                void deck1Bridge
                  .getActions()
                  ?.addUrl(streamUrl, streamTitle)
                  .then(() => {
                    setStreamUrl("");
                    setStreamTitle("");
                    setStudioNotice("Хөгжмийн эх үүсвэр нэмэгдлээ!");
                  });
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/60">
                  <Link2 size={12} /> YouTube / Аудио файл нэмэх
                </span>
                <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/15">
                  <Upload size={12} /> MP3/WAV (80MB)
                  <input
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.ogg,.opus,.aac,.flac,.webm"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.currentTarget.value = "";
                      if (f) void deck1Bridge.getActions()?.addFile(f);
                    }}
                  />
                </label>
              </div>
              <input
                type="url"
                required
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... эсвэл playlist"
                className="w-full rounded-xl bg-black/35 px-3 py-2 text-xs text-white placeholder-white/35 ring-1 ring-white/12 focus:outline-none focus:ring-amber-400/60"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="Нэр өгөх (заавал биш)"
                  maxLength={100}
                  className="flex-1 rounded-xl bg-black/35 px-3 py-1.5 text-xs text-white placeholder-white/35 ring-1 ring-white/12 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:opacity-95"
                  style={{ background: accent }}
                >
                  Нэмэх
                </button>
              </div>
            </form>

            {deck1.sources.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-white/45">
                  Хадгалсан дуунууд ({deck1.sources.length})
                </div>
                {deck1.sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => deck1Bridge.getActions()?.select(s.id)}
                      className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-white hover:text-amber-300"
                    >
                      {deck1.selected === s.id ? "▶ " : ""}
                      {s.title}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void deck1Bridge.getActions()?.removeSource(s.id)
                      }
                      className="text-white/45 hover:text-red-300"
                      title="Устгах"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Custom Mixes Card */}
          <div className="glass rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[15px] font-bold text-white">
                💾 Миний хадгалсан миксүүд
              </h3>
              <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/65">
                {savedMixes.length}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-white/55">
              Deck 1 хөгжим + 13 сувгийн түвшинг нэг товчоор дуудахаар хадгална.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={mixName}
                onChange={(e) => setMixName(e.target.value)}
                placeholder="Жишээ: Шөнийн код + Бороо"
                maxLength={50}
                className="flex-1 rounded-xl bg-black/35 px-3 py-2 text-xs text-white placeholder-white/35 ring-1 ring-white/12 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void saveCurrentMix()}
                disabled={activeCount === 0 && !deck1.playing}
                className="flex items-center gap-1.5 rounded-xl bg-white/12 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 disabled:opacity-45"
              >
                <BookmarkPlus size={14} /> Хадгалах
              </button>
            </div>

            {savedMixes.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {savedMixes.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => loadSavedMix(m)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-xs font-bold text-white">
                        🎧 {m.name}
                      </div>
                      <div className="truncate text-[10.5px] text-white/50">
                        {Object.keys(m.channels).length} амбиент суваг
                        {m.deck1Name ? ` · ${m.deck1Name}` : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSavedMix(m.id)}
                      className="text-white/45 hover:text-red-300"
                      aria-label={`${m.name} микс устгах`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timer-Linked Smart Audio Automation */}
          <div className="glass rounded-3xl p-4 md:p-5">
            <h3 className="font-display text-[15px] font-bold text-white">
              ⏱ Фокус цагтай автомат уялдах
            </h3>
            <div className="mt-3 space-y-2.5 text-xs text-white/80">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                <span>
                  <strong className="block text-white">
                    Завсарлагаар дууг зөөлрүүлэх (Auto-Duck)
                  </strong>
                  <small className="text-white/50">
                    Break эхлэхэд орчны дууг 45% болгож тайвшруулна
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={autoDuckOnBreak}
                  onChange={(e) =>
                    void toggleExtraFlag("autoDuckOnBreak", e.target.checked)
                  }
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                <span>
                  <strong className="block text-white">
                    Фокус эхлэхэд орчны дууг сэргээх
                  </strong>
                  <small className="text-white/50">
                    Идэвхтэй суваг байхгүй бол зөөлөн бороо автоматаар асна
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={autoStartFocusSound}
                  onChange={(e) =>
                    void toggleExtraFlag(
                      "autoStartFocusSound",
                      e.target.checked,
                    )
                  }
                />
              </label>
            </div>
          </div>

          <BondookCard
            mood="love"
            compact
            message="YouTube Lo-Fi эсвэл өөрийн дуун дээрээ Бороо + 10Hz Альфа долгион давхарлаад 'Хадгалах' дарчих — нэг товчоор гүн төвлөрлийн горимдоо орно!"
          />
        </div>
      </div>
    </div>
  );
}
