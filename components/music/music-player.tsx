"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AMBIENTS, THEME_MUSIC } from "@/lib/music/catalog";
import { youtubeURL } from "@/lib/music/youtube";
import { Icon } from "@/components/ui/icon";
import { useMusic } from "./music-provider";
import "./music.css";
export { MusicProvider } from "./music-provider";
const YouTubeEmbed = dynamic(
  () => import("./youtube-embed").then((m) => m.YouTubeEmbed),
  {
    ssr: false,
    loading: () => <p role="status">Бичлэгийг ачаалж байна…</p>,
  },
);
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
    add,
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
      data-kind={source ? "youtube" : "ambient"}
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
                : session.playback === "playing"
                  ? "Үргэлжлүүлэхэд Play дарна уу"
                  : playback === "paused"
                    ? "Түр зогссон"
                    : "Хөгжим сонгоод Play дараарай"}
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
            className="icon-button"
            aria-label="Хөгжим зогсоох"
            onClick={stop}
          >
            <Icon name="stop" size={18} />
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
          {!isAmbient && (
            <button className="text-button" onClick={retry}>
              Дахин ачаалах
            </button>
          )}
        </p>
      )}
      <div className="music-body">
        <div className="music-library" hidden={!open}>
          <div className="eyebrow">ӨРӨӨНД ТАНЬ ТОХИРОХ АЯ</div>
          <div className="music-recommendations">
            {THEME_MUSIC[data.settings.world.design].map((id) => (
              <button
                className="button small"
                key={id}
                onClick={() => select(`ambient:${id}`)}
              >
                {AMBIENTS.find((a) => a.id === id)?.name}
              </button>
            ))}
          </div>
          <div className="ambient-options">
            {AMBIENTS.map((a) => (
              <button
                key={a.id}
                aria-pressed={selected === `ambient:${a.id}`}
                onClick={() => select(`ambient:${a.id}`)}
              >
                <Icon
                  name={
                    a.id === "rain"
                      ? "rain"
                      : a.id === "nature"
                        ? "leaf"
                        : "music"
                  }
                />
                <strong>{a.name}</strong>
                <small>{a.detail}</small>
              </button>
            ))}
          </div>
          <form
            className="youtube-form"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label>
              YouTube video эсвэл playlist
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                maxLength={2048}
              />
            </label>
            <div className="button-row">
              <input
                aria-label="Хөгжмийн нэр"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Нэр өгөх (заавал биш)"
                maxLength={120}
              />
              <button className="button">Нэмэх</button>
            </div>
          </form>
          {sources.length > 0 && (
            <ul className="saved-music">
              {sources.map((s) => (
                <li key={s.id}>
                  <button
                    className="text-button"
                    aria-pressed={selected === s.id}
                    onClick={() => select(s.id)}
                  >
                    {s.title}
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
          )}
        </div>

        <div className="music-preview" hidden={!open && !source}>
          {source ? (
            <>
              {activated ? (
                <YouTubeEmbed
                  key={`${source.id}:${attempt}`}
                  source={source}
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
              <div className="music-details" hidden={!open}>
                <p className="tiny muted">
                  Багасгасан ч бичлэг энэ жижиг тоглуулагчид үргэлжилнэ. Дэлгэц
                  түгжих болон арын горим нь браузер, төхөөрөмж, YouTube-ээс
                  хамаарна.
                </p>
                <a
                  href={session.track.url || youtubeURL(source)}
                  target="_blank"
                  rel="noreferrer"
                >
                  YouTube дээр нээх ↗
                </a>
              </div>
            </>
          ) : (
            <>
              <span className="soundscape-art">
                <Icon
                  name={selected === "ambient:rain" ? "rain" : "leaf"}
                  size={60}
                />
              </span>
              <h3>{name}</h3>
              <p className="muted">
                Тухтай суугаад, нэг жижиг алхмаа эхлүүлээрэй.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={toggle}
              >
                {playing ? "Түр зогсоох" : "Аяыг эхлүүлэх"}
              </button>
            </>
          )}
          <div className="music-details" hidden={!open}>
            <div className="button-row mobile-music-steps">
              <button className="button small" onClick={() => next(-1)}>
                Өмнөх
              </button>
              <button className="button small" onClick={() => next(1)}>
                Дараах
              </button>
            </div>
            <p className="tiny music-terms">
              YouTube ашиглахад{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noreferrer"
              >
                YouTube нөхцөл
              </a>
              ,{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Google нууцлал
              </a>{" "}
              үйлчилнэ. Холбоос нээхэд YouTube-д холбогдоно.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
