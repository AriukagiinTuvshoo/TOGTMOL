"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useStudy } from "@/hooks/use-study";
import { AMBIENTS, THEME_MUSIC, type AmbientId } from "@/lib/music/catalog";
import type { AmbientPlayer } from "@/lib/music/ambient";
import { parseYouTube, youtubeURL } from "@/lib/music/youtube";
import type { YTPlayer } from "@/lib/music/youtube-player";
import type { MusicProvider as MusicAdapter } from "@/lib/music/provider";
import { uid } from "@/lib/constants";
import { Icon } from "@/components/ui/icon";
import { useMusicPreference } from "@/hooks/use-music-preference";
import {
  initialMusicSelection,
  type MusicPreferences,
} from "@/lib/music/preferences";
const YouTubeEmbed = dynamic(
  () => import("./youtube-embed").then((m) => m.YouTubeEmbed),
  { ssr: false, loading: () => <p>Бичлэгийг ачаалж байна…</p> },
);
function useMusicController() {
  const { data, store, run } = useStudy(),
    namespace = store.getSnapshot().namespace;
  const [preference, updatePreference] = useMusicPreference(namespace);
  const { volume, muted } = preference;
  const savePreference = (patch: Partial<MusicPreferences>) => {
    try {
      updatePreference(patch);
    } catch (e) {
      store.reportError(e);
    }
  };
  const [open, setOpen] = useState(false),
    [selection, setSelected] = useState(() =>
      initialMusicSelection(
        preference,
        data.settings.world.design,
        data.musicSources,
      ),
    ),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [attempt, setAttempt] = useState(0);
  const ambient = useRef<AmbientPlayer | null>(null),
    youtubeRef = useRef<YTPlayer | null>(null),
    providerRef = useRef<MusicAdapter | null>(null),
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
      try {
        ambient.current?.close();
      } catch {}
      ambient.current = null;
      try {
        youtubeRef.current?.pauseVideo();
      } catch {}
      youtubeRef.current = null;
      providerRef.current = null;
    };
  }, [namespace]);
  useEffect(() => {
    try {
      providerRef.current?.setVolume(volume, muted);
      if (youtubeRef.current) {
        youtubeRef.current.setVolume(volume * 100);
        if (muted) youtubeRef.current.mute();
        else youtubeRef.current.unMute();
      }
    } catch {
      const task = setTimeout(
        () => setError("Тоглуулагчтай холболт тасарсан. Дахин ачаалж болно."),
        0,
      );
      return () => clearTimeout(task);
    }
  }, [volume, muted, namespace, ready]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        try {
          youtubeRef.current?.pauseVideo();
        } catch {
          /* The embed may already be detached. */
        }
        if (!isAmbient) setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [isAmbient]);
  const pausePlayer = () => {
    try {
      const result = providerRef.current?.pause();
      if (result)
        void result.catch(() => {
          if (!disposed.current)
            setError("Хөгжим түр зогссон. Дахин ачаалж болно.");
        });
    } catch {
      if (!disposed.current) setError("Хөгжмийг дахин ачаална уу.");
    }
  };
  const stop = () => {
    generation.current++;
    pausePlayer();
    setPlaying(false);
  };
  const select = (id: string) => {
    stop();
    setSelected(id);
    setError("");
    setReady(false);
  };
  const minimize = () => {
    if (providerRef.current?.requiresVisiblePlayer) {
      pausePlayer();
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
      if (!youtubeRef.current) {
        setError("Бичлэгийг ачаалж дуустал хүлээнэ үү.");
        return;
      }
      try {
        await providerRef.current?.play();
      } catch {
        setError("YouTube-г дахин нээгээд оролдоно уу.");
      }
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
      providerRef.current = adapter;
      adapter.setVolume(volume, muted);
      await adapter.play();
      if (!disposed.current && generation.current === token) {
        setPlaying(true);
        savePreference({ lastPlayed: selected });
      } else await engine.pause();
    } catch (e) {
      if (!disposed.current)
        setError(e instanceof Error ? e.message : "Дуу эхэлсэнгүй.");
    } finally {
      if (!disposed.current) setBusy(false);
    }
  };
  const next = (direction: number) => {
    if (source?.kind === "playlist" && youtubeRef.current) {
      try {
        if (direction > 0) providerRef.current?.next?.();
        else providerRef.current?.previous?.();
      } catch {
        setError("Тоглуулагчийг дахин ачаална уу.");
      }
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
  return {
    data,
    store,
    run,
    volume,
    muted,
    savePreference,
    open,
    setOpen,
    playing,
    setPlaying,
    error,
    setError,
    url,
    setUrl,
    title,
    setTitle,
    busy,
    setReady,
    attempt,
    setAttempt,
    youtubeRef,
    providerRef,
    disposed,
    sources,
    selected,
    source,
    isAmbient,
    name,
    select,
    minimize,
    toggle,
    next,
    add,
  };
}
const MusicContext = createContext<ReturnType<
  typeof useMusicController
> | null>(null);
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const controller = useMusicController();
  return (
    <MusicContext.Provider value={controller}>{children}</MusicContext.Provider>
  );
}
export function MusicPlayer() {
  const context = useContext(MusicContext);
  if (!context) throw Error("MusicProvider шаардлагатай.");
  const {
    data,
    store,
    run,
    volume,
    muted,
    savePreference,
    open,
    setOpen,
    playing,
    setPlaying,
    error,
    setError,
    url,
    setUrl,
    title,
    setTitle,
    busy,
    setReady,
    attempt,
    setAttempt,
    youtubeRef,
    providerRef,
    disposed,
    sources,
    selected,
    source,
    isAmbient,
    name,
    select,
    minimize,
    toggle,
    next,
    add,
  } = context;
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
            onClick={() => savePreference({ muted: !muted })}
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
            onChange={(e) => savePreference({ volume: Number(e.target.value) })}
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
                    youtubeRef.current = p;
                    if (!p && providerRef.current?.kind === "youtube")
                      providerRef.current = null;
                    if (p) {
                      void import("@/lib/music/youtube-player")
                        .then(({ youtubeProvider }) => {
                          if (youtubeRef.current !== p || disposed.current)
                            return;
                          providerRef.current = youtubeProvider(p);
                          try {
                            providerRef.current.setVolume(volume, muted);
                          } catch {
                            setError("YouTube бэлэн болоогүй байна.");
                          }
                        })
                        .catch(() =>
                          setError("YouTube удирдлагыг ачаалж чадсангүй."),
                        );
                    }
                    setReady(Boolean(p));
                    if (!p) setPlaying(false);
                  }}
                  onState={(s) => {
                    setPlaying(s === 1);
                    if (s === 1) savePreference({ lastPlayed: selected });
                  }}
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
