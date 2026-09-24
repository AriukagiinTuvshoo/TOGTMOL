"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AMBIENTS } from "@/lib/music/catalog";
import { ROOM_THEMES } from "@/lib/world/room-themes";
import { youtubeURL } from "@/lib/music/youtube";
import { Icon } from "@/components/ui/icon";
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
    data,
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
    isAmbient,
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

  useEffect(() => {
    const element = dock.current;
    const shell = element?.closest<HTMLElement>(".app-shell");
    if (!element || !shell) return;
    const measure = () =>
      shell.style.setProperty(
        "--music-dock-height",
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
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
      className={`music-player music-dock ${open ? "music-expanded" : ""}`}
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
          <span className={`music-disc ${playing ? "is-playing" : ""}`}>
            <Icon name="music" />
          </span>
          <span>
            <strong>{name}</strong>
            <small>
              {playing
                ? "Тоглож байна"
                : playback === "paused"
                  ? "Түр зогссон"
                  : "Хөгжим сонгоод эхлүүлнэ"}
            </small>
          </span>
        </button>

        <div className="music-controls">
          <button
            className="icon-button music-step"
            aria-label="Өмнөх хөгжим"
            onClick={() => next(-1)}
          >
            <Icon name="previous" size={18} />
          </button>
          <button
            className="icon-button music-play"
            aria-label={playing ? "Хөгжим түр зогсоох" : "Хөгжим тоглуулах"}
            onClick={toggle}
            disabled={busy}
          >
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <button
            className="icon-button music-step"
            aria-label="Дараагийн хөгжим"
            onClick={() => next(1)}
          >
            <Icon name="next" size={18} />
          </button>
          <button
            className="icon-button music-stop"
            aria-label="Хөгжим зогсоох"
            onClick={stop}
            disabled={!playing && playback === "stopped"}
          >
            <Icon name="stop" size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={muted ? "Дууг нээх" : "Дууг хаах"}
            aria-pressed={muted}
            onClick={() => void savePreference({ muted: !muted })}
          >
            <Icon name={muted ? "muted" : "volume"} size={18} />
          </button>
          <input
            className="music-volume"
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
            <Icon name={open ? "chevron-down" : "chevron-up"} size={18} />
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

      <div className="music-body">
        <section className="music-library" hidden={!open}>
          <div className="music-library-heading">
            <div>
              <span className="eyebrow">МИНИЙ ХӨГЖМИЙН САН</span>
              <p className="tiny muted">
                Цөөн, хэрэгтэй аялгуу. Өөрийн дуугаа бас хадгалж болно.
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
                  accept="audio/*,video/mp4,.mp3,.m4a,.wav,.ogg,.oga,.opus,.aac,.flac,.webm,.mp4"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.currentTarget.value = "";
                    void addFile(file);
                  }}
                />
                <span className="button small">
                  <Icon name="upload" size={16} /> MP3 / MP4 файл
                </span>
              </label>
              <span className="tiny muted">
                80 MB хүртэл · MP3 болон MP4 · төхөөрөмж дээр хадгална
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
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…/song.mp3"
                  maxLength={2048}
                />
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
              <span className="eyebrow">ХАДГАЛСАН</span>
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
                        size={16}
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
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="tiny music-storage-note">
            Upload хийсэн файл энэ төхөөрөмжийн браузерийн хадгалалтад үлдэнэ.
            Аудио/MP4 холбоос нь холбоосоо хадгалж, тоглуулах үед интернэт
            ашиглана.
          </p>
        </section>

        <div
          className={`music-preview ${source?.kind === "audio" ? "music-native-preview" : ""}`}
          hidden={!open && !source}
        >
          {source?.kind === "audio" ? (
            <div className="music-native-card">
              <span className="soundscape-art">
                <Icon name="music" size={36} />
              </span>
              <div>
                <span className="eyebrow">{sourceKind(source)}</span>
                <h3>{name}</h3>
                <p className="muted">
                  {playing
                    ? "Дэмждэг браузер, төхөөрөмж дээр background-аар үргэлжилнэ."
                    : "Үргэлжлүүлэхэд Play дарна уу."}
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
                    YouTube-ийн playback нь браузер, төхөөрөмжөөс хамаарна.
                    Background/lock-screen control нь native audio шиг
                    тогтвортой биш байж болно.
                  </p>
                  <a
                    href={session.track.url || youtubeURL(source)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube дээр нээх ↗
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="music-native-card">
              <span className="soundscape-art">
                <Icon
                  name={selected === "ambient:rain" ? "rain" : "leaf"}
                  size={36}
                />
              </span>
              <div>
                <span className="eyebrow">STUDY SOUNDS</span>
                <h3>{name}</h3>
                <p className="muted">
                  Нэг жижиг алхамдаа анхаарлаа төвлөрүүлээрэй.
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
      </div>
    </aside>
  );
}
