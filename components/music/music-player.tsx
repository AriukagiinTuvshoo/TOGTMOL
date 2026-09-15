"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useStudy } from "@/hooks/use-study";
import { AMBIENTS, type AmbientId } from "@/lib/music/catalog";
import type { AmbientPlayer } from "@/lib/music/ambient";
import { parseYouTube, youtubeURL } from "@/lib/music/youtube";
import type { YTPlayer } from "@/lib/music/youtube-player";
import type { MusicProvider } from "@/lib/music/provider";
import { uid } from "@/lib/constants";
import { Icon } from "@/components/ui/icon";
const YouTubeEmbed = dynamic(
  () => import("./youtube-embed").then((m) => m.YouTubeEmbed),
  { ssr: false, loading: () => <p>Бичлэгийг ачаалж байна…</p> },
);
function readPreference(namespace: string) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`togtmol:music:${namespace}`) ?? "null",
    );
    if (saved && Number.isFinite(saved.volume))
      return {
        volume: Math.max(0, Math.min(1, saved.volume)),
        muted: saved.muted === true,
      };
  } catch {
    /* Preferences are optional. */
  }
  return { volume: 0.4, muted: false };
}
export function MusicPlayer() {
  const { data, store, run } = useStudy(),
    namespace = store.getSnapshot().namespace;
  const [preference] = useState(() => readPreference(namespace));
  const [open, setOpen] = useState(false),
    [selection, setSelected] = useState("ambient:lofi"),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(preference.volume),
    [muted, setMuted] = useState(preference.muted),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [attempt, setAttempt] = useState(0);
  const ambient = useRef<AmbientPlayer | null>(null),
    youtube = useRef<YTPlayer | null>(null),
    provider = useRef<MusicProvider | null>(null),
    disposed = useRef(false),
    generation = useRef(0);
  const sources = data.musicSources.filter((s) => !s.deletedAt),
    selected =
      selection.startsWith("ambient:") ||
      sources.some((s) => s.id === selection)
        ? selection
        : "ambient:lofi",
    source = sources.find((s) => s.id === selected),
    isAmbient = selected.startsWith("ambient:"),
    name =
      source?.title ??
      AMBIENTS.find((a) => `ambient:${a.id}` === selected)?.name ??
      "Хөгжим сонгох";
  useEffect(() => {
    disposed.current = false;
    generation.current++;
    return () => {
      disposed.current = true;
      ambient.current?.close();
      ambient.current = null;
      youtube.current?.pauseVideo();
    };
  }, [namespace]);
  useEffect(() => {
    provider.current?.setVolume(volume, muted);
    if (youtube.current) {
      youtube.current.setVolume(volume * 100);
      if (muted) youtube.current.mute();
      else youtube.current.unMute();
    }
    try {
      localStorage.setItem(
        `togtmol:music:${namespace}`,
        JSON.stringify({ volume, muted }),
      );
    } catch {
      /* Playback remains usable without preference storage. */
    }
  }, [volume, muted, namespace, ready]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        youtube.current?.pauseVideo();
        if (!isAmbient) setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [isAmbient]);
  const stop = () => {
    generation.current++;
    void provider.current?.pause();
    setPlaying(false);
  };
  const select = (id: string) => {
    stop();
    setSelected(id);
    setError("");
    setReady(false);
  };
  const minimize = () => {
    if (provider.current?.requiresVisiblePlayer) {
      void provider.current.pause();
      setPlaying(false);
    }
    setOpen(false);
  };
  const toggle = async () => {
    setError("");
    if (playing) {
      stop();
      return;
    }
    if (!isAmbient) {
      if (!open) {
        setOpen(true);
        return;
      }
      if (!youtube.current) {
        setError("Бичлэгийг ачаалж дуустал хүлээнэ үү.");
        return;
      }
      await provider.current?.play();
      return;
    }
    const token = ++generation.current;
    setBusy(true);
    try {
      const { AmbientPlayer, ambientProvider } =
        await import("@/lib/music/ambient");
      if (disposed.current || generation.current !== token) return;
      const engine = ambient.current ?? new AmbientPlayer();
      ambient.current = engine;
      const adapter = ambientProvider(engine, selected.slice(8) as AmbientId);
      provider.current = adapter;
      adapter.setVolume(volume, muted);
      await adapter.play();
      if (!disposed.current && generation.current === token) setPlaying(true);
      else await engine.pause();
    } catch (e) {
      if (!disposed.current)
        setError(e instanceof Error ? e.message : "Дуу эхэлсэнгүй.");
    } finally {
      if (!disposed.current) setBusy(false);
    }
  };
  const next = (direction: number) => {
    if (source?.kind === "playlist" && youtube.current) {
      if (direction > 0) provider.current?.next?.();
      else provider.current?.previous?.();
      return;
    }
    const options = [
        ...AMBIENTS.map((a) => `ambient:${a.id}`),
        ...sources.map((s) => s.id),
      ],
      i = options.indexOf(selected);
    select(options[(i + direction + options.length) % options.length]);
  };
  const add = async () => {
    let parsed;
    try {
      parsed = parseYouTube(url);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const old = sources.find(
      (s) => s.kind === parsed.kind && s.youtubeId === parsed.youtubeId,
    );
    if (old) {
      select(old.id);
      return;
    }
    const now = Date.now(),
      newSource = {
        ...parsed,
        id: uid("music"),
        title:
          title.trim().slice(0, 120) ||
          (parsed.kind === "playlist"
            ? "Миний YouTube playlist"
            : "Миний YouTube бичлэг"),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        extras: {},
      };
    if (
      await run(() =>
        store.mutate((d) => ({
          ...d,
          musicSources: [...d.musicSources, newSource],
        })),
      )
    ) {
      select(newSource.id);
      setUrl("");
      setTitle("");
    }
  };
  return (
    <aside
      className={`music-player ${open ? "music-expanded" : ""}`}
      aria-label="Study music"
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
                : isAmbient
                  ? "Тогтмолын ая, чимээ"
                  : "YouTube · тоглуулагчийг нээх"}
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
            aria-label={muted ? "Дууг нээх" : "Дууг хаах"}
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
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
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <button
            className="icon-button"
            aria-label={open ? "Хөгжим багасгах" : "Хөгжим нээх"}
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
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setAttempt((a) => a + 1);
              }}
            >
              Дахин ачаалах
            </button>
          )}
        </p>
      )}
      {open && (
        <div className="music-panel">
          <div className="music-library">
            <div className="eyebrow">CHOOSE YOUR ATMOSPHERE</div>
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
                      onClick={async () => {
                        if (
                          await run(() =>
                            store.mutate((d) => ({
                              ...d,
                              musicSources: d.musicSources.map((m) =>
                                m.id === s.id
                                  ? {
                                      ...m,
                                      deletedAt: Date.now(),
                                      updatedAt: Date.now(),
                                    }
                                  : m,
                              ),
                            })),
                          )
                        ) {
                          if (selected === s.id) select("ambient:lofi");
                        }
                      }}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="music-preview">
            {source ? (
              <>
                <YouTubeEmbed
                  key={`${source.id}:${attempt}`}
                  source={source}
                  onReady={(p) => {
                    youtube.current = p;
                    if (p) {
                      void import("@/lib/music/youtube-player").then(
                        ({ youtubeProvider }) => {
                          if (youtube.current !== p || disposed.current) return;
                          provider.current = youtubeProvider(p);
                          provider.current.setVolume(volume, muted);
                        },
                      );
                    }
                    setReady(Boolean(p));
                    if (!p) setPlaying(false);
                  }}
                  onState={(s) => setPlaying(s === 1)}
                  onError={setError}
                />
                <p className="tiny muted">
                  Бичлэг доторх Play-г дарж эхлүүлээрэй. Багасгах эсвэл өөр tab
                  руу ороход түр зогсоно.
                </p>
                <a href={youtubeURL(source)} target="_blank" rel="noreferrer">
                  YouTube дээр нээх ↗
                </a>
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
      )}
    </aside>
  );
}
