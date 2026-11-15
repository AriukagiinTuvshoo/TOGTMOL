"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { AMBIENTS } from "@/lib/music/catalog";
import { youtubeURL } from "@/lib/music/youtube";
import { Icon } from "@/components/ui/icon";
import { CHANNELS, PRESETS, engine } from "@/lib/v9/audio-engine";
import { useMusic } from "./music-provider";
import "./music.css";
import type { MusicSource } from "@/types/study";
export { MusicProvider } from "./music-provider";

const YouTubeEmbed = dynamic(
  () => import("./youtube-embed").then((m) => m.YouTubeEmbed),
  {
    ssr: false,
    loading: () => <p role="status">Бичлэгийг ачаалж байна…</p>,
  },
);

function isYouTubeSource(
  source: MusicSource,
): source is MusicSource & { kind: "video" | "playlist"; youtubeId: string } {
  return source.kind === "video" || source.kind === "playlist";
}

function sourceKind(source: MusicSource) {
  if (source.kind === "audio")
    return source.audioStorageKey ? "Төхөөрөмжийн файл" : "Аудио холбоос";
  return "YouTube";
}

export function MusicPlayer() {
  const {
    volume,
    muted,
    savePreference,
    session,
    playback,
    activated,
    open,
    setOpen,
    playing,
    error,
    url,
    setUrl,
    title,
    setTitle,
    busy,
    attempt,
    sources,
    selected,
    source,
    name,
    select,
    minimize,
    toggle,
    stop,
    next,
    addURL,
    addFile,
    remove,
    retry,
    onReady,
    onState,
    onError,
  } = useMusic();

  const dock = useRef<HTMLElement>(null);
  const [drawerTab, setDrawerTab] = useState<"library" | "layers">("library");
  const engState = useSyncExternalStore(
    engine.subscribe,
    engine.getSnapshot,
    engine.getSnapshot,
  );

  const activeLayerCount = CHANNELS.filter(
    (c) => (engState.mix[c.id] ?? 0) > 0.01,
  ).length;

  useEffect(() => {
    const element = dock.current;
    const shell = element?.closest<HTMLElement>(".app-shell");
    if (!element || !shell) return;
    const measure = () =>
      shell.style.setProperty(
        "--music-dock-height",
        `${Math.ceil(Math.min(72, element.getBoundingClientRect().height))}px`,
      );
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      shell.style.removeProperty("--music-dock-height");
    };
  }, []);

  return (
    <aside
      ref={dock}
      className={`music-player music-dock v10-audio-dock ${open ? "music-expanded" : ""}`}
      aria-label="Study music"
      data-open={open}
      data-kind={source?.kind ?? "ambient"}
      data-playback={playback}
    >
      <div className="music-bar">
        <button
          className="music-title"
          aria-expanded={open}
          onClick={() => (open ? minimize() : setOpen(true))}
        >
          <span
            className={`music-disc ${playing || activeLayerCount > 0 ? "is-playing" : ""}`}
          >
            <Icon name="music" />
          </span>
          <span>
            <strong>{name}</strong>
            <small>
              {playing
                ? activeLayerCount > 0
                  ? `Тоглож байна · +${activeLayerCount} давхарга`
                  : "Тоглож байна"
                : activeLayerCount > 0
                  ? `Орчны ${activeLayerCount} суваг идэвхтэй`
                  : playback === "paused" && session.playback === "playing"
                    ? "Үргэлжлүүлэхэд Play дарна уу"
                    : playback === "paused"
                      ? "Түр зогссон"
                      : "Хөгжим & орчны дуу"}
            </small>
          </span>
        </button>

        <div className="music-controls">
          <button
            className="icon-button music-step"
            aria-label="Өмнөх хөгжим"
            onClick={() => next(-1)}
          >
            <Icon name="previous" size={16} />
          </button>
          <button
            className="icon-button music-play"
            aria-label={playing ? "Хөгжим түр зогсоох" : "Хөгжим тоглуулах"}
            onClick={toggle}
            disabled={busy}
          >
            <Icon name={playing ? "pause" : "play"} size={16} />
          </button>
          <button
            className="icon-button music-step"
            aria-label="Дараагийн хөгжим"
            onClick={() => next(1)}
          >
            <Icon name="next" size={16} />
          </button>
          <button
            className="icon-button music-stop"
            aria-label="Хөгжим зогсоох"
            onClick={stop}
            disabled={!playing && playback === "stopped"}
          >
            <Icon name="stop" size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={muted ? "Дууг нээх" : "Дууг хаах"}
            aria-pressed={muted}
            onClick={() => void savePreference({ muted: !muted })}
          >
            <Icon name={muted ? "muted" : "volume"} size={16} />
          </button>
          <input
            className="music-volume v9-range"
            aria-label="Дууны түвшин"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={volume}
            onChange={(e) =>
              void savePreference({ volume: Number(e.target.value) })
            }
          />
          <button
            className="icon-button"
            aria-label={open ? "Хөгжим багасгах" : "Хөгжим нээх"}
            aria-expanded={open}
            onClick={() => (open ? minimize() : setOpen(true))}
          >
            <Icon name={open ? "chevron-down" : "chevron-up"} size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="music-error" role="status">
          {error}
          <button className="text-button" onClick={retry}>
            Дахин ачаалах
          </button>
        </p>
      )}

      {open && (
        <div
          className="music-drawer-tabs"
          role="tablist"
          aria-label="Аудио табууд"
        >
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === "library"}
            className={`music-drawer-tab ${drawerTab === "library" ? "is-active" : ""}`}
            onClick={() => setDrawerTab("library")}
          >
            🎵 Хөгжим & YouTube
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === "layers"}
            className={`music-drawer-tab ${drawerTab === "layers" ? "is-active" : ""}`}
            onClick={() => setDrawerTab("layers")}
          >
            🎛 Орчны давхарга{" "}
            {activeLayerCount > 0 ? `(${activeLayerCount})` : ""}
          </button>
        </div>
      )}

      <div className="music-body">
        {/* Persistent Preview / YouTube Stage (never unmounted while source exists so playback stays uninterrupted) */}
        <div
          className={`music-preview ${source?.kind === "audio" ? "music-native-preview" : ""}`}
          hidden={!open && !source}
        >
          {source?.kind === "audio" ? (
            <div className="music-native-card">
              <span className="soundscape-art">
                <Icon name="music" size={28} />
              </span>
              <div>
                <span className="eyebrow">{sourceKind(source)}</span>
                <h3>{name}</h3>
                <p className="muted">
                  {playing
                    ? "Background горимд тасралтгүй тоглож байна."
                    : "Play дарж эхлүүлнэ үү."}
                </p>
              </div>
            </div>
          ) : source && isYouTubeSource(source) ? (
            <div className="music-youtube-runtime">
              {activated ? (
                <YouTubeEmbed
                  key={`${source.id}:${attempt}`}
                  source={
                    source as MusicSource & {
                      kind: "video" | "playlist";
                      youtubeId: string;
                    }
                  }
                  resume={session}
                  onReady={onReady}
                  onState={onState}
                  onError={onError}
                />
              ) : (
                <button className="button small" onClick={() => setOpen(true)}>
                  YouTube тоглуулагчийг ачаалах
                </button>
              )}
              {open && (
                <div className="music-details">
                  <p className="tiny muted">
                    Таб шилжих болон багасгах үед YouTube тасралтгүй үргэлжилнэ.
                  </p>
                  <a
                    href={session.track.url || youtubeURL(source)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube ↗
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="music-native-card">
              <span className="soundscape-art">
                <Icon
                  name={selected === "ambient:rain" ? "rain" : "leaf"}
                  size={28}
                />
              </span>
              <div>
                <span className="eyebrow">DECK 1 · STUDY LOOP</span>
                <h3>{name}</h3>
                <p className="muted">
                  13 сувгийн орчны дуутай зэрэг давхарлан сонсож болно.
                </p>
              </div>
            </div>
          )}
          {open && (
            <div className="music-details">
              <div className="button-row mobile-music-steps">
                <button className="button small" onClick={() => next(-1)}>
                  Өмнөх
                </button>
                <button className="button small" onClick={() => next(1)}>
                  Дараах
                </button>
              </div>
            </div>
          )}
        </div>

        <section
          className="music-library"
          hidden={!open || drawerTab !== "library"}
        >
          <div className="music-library-heading">
            <div>
              <span className="eyebrow">DECK 1 · МИНИЙ ХӨГЖМИЙН САН</span>
              <p className="tiny muted">
                Суурь аялгуу, YouTube playlist болон өөрийн аудио файл.
              </p>
            </div>
            <span className="music-count">
              {sources.length + AMBIENTS.length}
            </span>
          </div>

          <div className="ambient-options">
            {AMBIENTS.map((a) => (
              <button
                key={a.id}
                className="ambient-option"
                aria-pressed={selected === `ambient:${a.id}`}
                onClick={() => select(`ambient:${a.id}`)}
              >
                <span className="ambient-option-icon">
                  <Icon
                    name={
                      a.id === "rain"
                        ? "rain"
                        : a.id === "nature"
                          ? "leaf"
                          : "music"
                    }
                  />
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.detail}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="music-add-box">
            <div className="music-add-row">
              <label className="music-upload">
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.ogg,.oga,.opus,.aac,.flac,.webm"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.currentTarget.value = "";
                    void addFile(file);
                  }}
                />
                <span className="button small">
                  <Icon name="upload" size={15} /> Аудио файл
                </span>
              </label>
              <span className="tiny muted">
                80 MB хүртэл · офлайн хадгалагдана
              </span>
            </div>

            <form
              className="audio-url-form"
              onSubmit={(e) => {
                e.preventDefault();
                void addURL();
              }}
            >
              <label>
                YouTube video эсвэл playlist
                <input
                  aria-label="YouTube video эсвэл playlist"
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="YouTube эсвэл аудио холбоос оруулна уу"
                  maxLength={2048}
                />
                <span className="tiny muted">
                  YouTube video/playlist болон шууд аудио холбоос дэмжинэ.
                </span>
              </label>
              <div className="button-row">
                <input
                  aria-label="Хөгжмийн нэр"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Нэр өгөх"
                  maxLength={120}
                />
                <button className="button" disabled={busy}>
                  Нэмэх
                </button>
              </div>
            </form>
          </div>

          {sources.length > 0 && (
            <div className="saved-music">
              <span className="eyebrow">ХАДГАЛСАН ЖАГСААЛТ</span>
              <ul>
                {sources.map((s) => (
                  <li key={s.id}>
                    <button
                      className="saved-music-select"
                      aria-pressed={selected === s.id}
                      onClick={() => select(s.id)}
                    >
                      <Icon
                        name={s.kind === "audio" ? "music" : "cloud"}
                        size={15}
                      />
                      <span>
                        <strong>{s.title}</strong>
                        <small>{sourceKind(s)}</small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`${s.title} устгах`}
                      onClick={() => void remove(s.id)}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="tiny music-storage-note">
            Upload хийсэн файл энэ төхөөрөмжийн IndexedDB-д хадгалагдана.
          </p>
        </section>

        {open && drawerTab === "layers" && (
          <section className="music-layers-pane">
            <div className="music-library-heading">
              <div>
                <span className="eyebrow">DECK 2 & 3 · 13-СУВАГ ОРЧИН</span>
                <p className="tiny muted">
                  YouTube болон хөгжмийн дээр бороо, кафе, тархины долгион
                  давхарлана.
                </p>
              </div>
              {activeLayerCount > 0 && (
                <button
                  type="button"
                  className="v9-btn v9-btn-ghost v9-btn-sm"
                  onClick={() => engine.stopAll()}
                >
                  Зогсоох
                </button>
              )}
            </div>

            <div className="music-quick-presets">
              {PRESETS.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`v9-preset-pill ${engState.activePreset === p.id ? "is-active" : ""}`}
                  onClick={() => engine.applyPreset(p.id)}
                >
                  <span>{p.emoji}</span>
                  <span>{p.nameMn}</span>
                </button>
              ))}
            </div>

            <div className="music-mini-channels">
              {CHANNELS.slice(0, 8).map((ch) => {
                const v = engState.mix[ch.id] ?? 0;
                return (
                  <label key={ch.id} className="music-mini-ch">
                    <span>
                      <strong>{ch.nameMn}</strong>
                      <small>{Math.round(v * 100)}%</small>
                    </span>
                    <input
                      type="range"
                      className="v9-range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={v}
                      aria-label={`${ch.nameMn} суваг`}
                      onChange={(e) =>
                        engine.setChannel(ch.id, Number(e.target.value))
                      }
                    />
                  </label>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
