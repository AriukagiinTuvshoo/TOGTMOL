"use client";
import {
  Component,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStudy } from "@/hooks/use-study";
import { useMusicPreference } from "@/hooks/use-music-preference";
import { useMusicMediaSession } from "@/hooks/use-music-media-session";
import { AMBIENTS, type AmbientId } from "@/lib/music/catalog";
import type { AmbientPlayer } from "@/lib/music/ambient";
import type { MusicProvider as MusicAdapter } from "@/lib/music/provider";
import { youtubeProvider, type YTPlayer } from "@/lib/music/youtube-player";
import {
  initialMusicSelection,
  normalizeMusicSession,
  type MusicSession,
  type PlaybackState,
} from "@/lib/music/preferences";
import { parseYouTube, youtubeURL } from "@/lib/music/youtube";
import { uid } from "@/lib/constants";

function useMusicController() {
  const { data, store } = useStudy();
  const namespace = store.getSnapshot().namespace;
  const [preference, updatePreference, storageError] =
    useMusicPreference(namespace);
  const [session, setSession] = useState<MusicSession>(() => {
    const selection = initialMusicSelection(
      preference,
      data.settings.world.design,
      data.musicSources,
    );
    const previous =
      preference.rememberLast && preference.session?.selection === selection
        ? preference.session
        : null;
    const source = data.musicSources.find(
      (s) => !s.deletedAt && s.id === selection,
    );
    return (
      previous ?? {
        selection,
        open: preference.session?.open ?? false,
        playback: "stopped",
        position: 0,
        playlistIndex: 0,
        track: {
          title:
            source?.title ??
            AMBIENTS.find((a) => `ambient:${a.id}` === selection)?.name ??
            "Хөгжим сонгох",
          artist: source ? "YouTube" : "Тогтмол",
          videoId: youtubeSource?.kind === "video" ? youtubeSource.youtubeId : null,
          url: youtubeSource ? youtubeURL(youtubeSource) : "",
        },
      }
    );
  });
  // Remember intent, but never pretend a reloaded iframe/AudioContext is already playing.
  const [playback, setPlayback] = useState<PlaybackState>(
    session.playback === "stopped" ? "stopped" : "paused",
  );
  const [activated, setActivated] = useState(
    session.open || session.playback !== "stopped",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState(""),
    [title, setTitle] = useState("");
  const latest = useRef(session),
    actual = useRef(playback),
    mounted = useRef(true),
    generation = useRef(0),
    playWhenReady = useRef(false);
  const ambient = useRef<AmbientPlayer | null>(null),
    youtube = useRef<YTPlayer | null>(null),
    adapter = useRef<MusicAdapter | null>(null);
  const sources = data.musicSources.filter((s) => !s.deletedAt);
  const selected = session.selection,
    source = sources.find((s) => s.id === selected),
    youtubeSource =
      source && source.kind !== "audio" ? source : undefined,
    isAmbient = selected.startsWith("ambient:");
  const { volume, muted } = preference;
  const commit = (patch: Partial<MusicSession>) => {
    if (!mounted.current || store.getSnapshot().namespace !== namespace) return;
    const next = normalizeMusicSession({ ...latest.current, ...patch })!;
    if (JSON.stringify(next) === JSON.stringify(latest.current)) return;
    latest.current = next;
    setSession(next);
    void updatePreference({
      session: next,
      ...(next.playback === "playing" ? { lastPlayed: next.selection } : {}),
    });
  };
  const mark = (state: PlaybackState) => {
    actual.current = state;
    setPlayback(state);
  };
  const fail = (message: string) => {
    if (!mounted.current) return;
    setBusy(false);
    setError(message);
  };
  const capture = (): MusicSession => {
    let current = latest.current;
    const player = youtube.current;
    if (!player || current.selection.startsWith("ambient:")) return current;
    try {
      if ([-1, 5].includes(player.getPlayerState())) return current;
      const details = player.getVideoData?.();
      const videoURL = player.getVideoUrl?.();
      const id =
        details?.video_id ??
        (videoURL ? new URL(videoURL).searchParams.get("v") : null);
      current = normalizeMusicSession({
        ...current,
        position:
          actual.current === "stopped"
            ? 0
            : (player.getCurrentTime?.() ?? current.position),
        playlistIndex: player.getPlaylistIndex?.() ?? current.playlistIndex,
        track: {
          ...current.track,
          title: details?.title || current.track.title,
          artist: details?.author || current.track.artist,
          ...(id && /^[a-zA-Z0-9_-]{11}$/.test(id)
            ? { videoId: id, url: `https://www.youtube.com/watch?v=${id}` }
            : {}),
        },
      })!;
    } catch {
      /* A temporarily detached metadata getter cannot interrupt playback or study. */
    }
    return current;
  };
  const control = (kind: "pause" | "stop") => {
    generation.current++;
    playWhenReady.current = false;
    const snapshot = capture();
    mark(kind === "stop" ? "stopped" : "paused");
    setBusy(false);
    commit({
      ...snapshot,
      playback: actual.current,
      ...(kind === "stop" ? { position: 0 } : {}),
    });
    try {
      const target = adapter.current;
      void target?.[kind]().catch(() => {
        if (adapter.current === target)
          fail("Хөгжмийн удирдлага тасарлаа. Дахин ачаалж болно.");
      });
    } catch {
      fail("Хөгжмийн удирдлага тасарлаа. Дахин ачаалж болно.");
    }
  };
  const pause = () => control("pause"),
    stop = () => control("stop");
  const play = async (id = latest.current.selection) => {
    if (actual.current === "playing" && id === latest.current.selection) return;
    setError("");
    const token = ++generation.current;
    if (!id.startsWith("ambient:")) {
      if (!youtube.current || adapter.current?.kind !== "youtube") {
        playWhenReady.current = true;
        setActivated(true);
        setBusy(true);
        return;
      }
      try {
        const target = adapter.current;
        if (actual.current === "stopped") youtube.current?.seekTo?.(0, true);
        await target.play();
        if (!mounted.current || token !== generation.current) return;
        // onState reports actual playback, including native iframe controls/autoplay rejection.
      } catch {
        fail("YouTube-г тоглуулж чадсангүй. Дахин ачаалж болно.");
      }
      return;
    }
    setBusy(true);
    try {
      const { AmbientPlayer, ambientProvider } =
        await import("@/lib/music/ambient");
      if (!mounted.current || token !== generation.current) return;
      const engine = ambient.current ?? new AmbientPlayer();
      ambient.current = engine;
      const target = ambientProvider(engine, id.slice(8) as AmbientId);
      adapter.current = target;
      target.setVolume(volume, muted);
      await target.play();
      if (!mounted.current || token !== generation.current) return;
      mark("playing");
      commit({ playback: "playing" });
    } catch {
      if (token === generation.current)
        fail("Дуу эхэлсэнгүй. Play-г дахин дарж үзнэ үү.");
    } finally {
      if (mounted.current && token === generation.current) setBusy(false);
    }
  };
  const select = (id: string, resume = actual.current === "playing") => {
    if (id === latest.current.selection) return;
    generation.current++;
    playWhenReady.current = false;
    try {
      void adapter.current?.pause().catch(() => {});
    } catch {}
    adapter.current = null;
    youtube.current = null;
    mark("paused");
    setBusy(false);
    setError("");
    const target = sources.find((s) => s.id === id);
    commit({
      selection: id,
      playback: resume ? "playing" : "stopped",
      position: 0,
      playlistIndex: 0,
      track: {
        title:
          target?.title ??
          AMBIENTS.find((a) => `ambient:${a.id}` === id)?.name ??
          "Хөгжим",
        artist: target ? "YouTube" : "Тогтмол",
        videoId: target?.kind === "video" ? target.youtubeId : null,
        url: target && target.kind !== "audio" ? youtubeURL(target) : "",
      },
    });
    setActivated(true);
    if (resume) {
      if (id.startsWith("ambient:")) void play(id);
      else playWhenReady.current = true;
    } else mark("stopped");
  };
  const setOpen = (open: boolean) => {
    commit({ ...capture(), open });
    if (open) setActivated(true);
  };
  const onReady = (player: YTPlayer | null) => {
    youtube.current = player;
    if (!player) {
      if (adapter.current?.kind === "youtube") adapter.current = null;
      return;
    }
    if (!mounted.current) return;
    adapter.current = youtubeProvider(player);
    try {
      adapter.current.setVolume(volume, muted);
    } catch {
      fail("YouTube дууны түвшинг тохируулж чадсангүй.");
    }
    setBusy(false);
    if (playWhenReady.current) {
      playWhenReady.current = false;
      void play();
    }
  };
  const onState = (state: number) => {
    if (!mounted.current) return;
    if (state === 1) mark("playing");
    else if (state === 2 && actual.current !== "stopped") mark("paused");
    else if (state === 0) mark("stopped");
    else return; // Buffering/cued is not a pause request and must not erase restored state.
    setBusy(false);
    commit({ ...capture(), playback: actual.current });
  };
  const onError = (message: string) => {
    playWhenReady.current = false;
    mark("paused");
    commit({ playback: "paused" });
    fail(message);
  };
  const next = (direction: number) => {
    if (source?.kind === "playlist" && adapter.current?.kind === "youtube") {
      try {
        if (direction > 0) adapter.current.next?.();
        else adapter.current.previous?.();
      } catch {
        fail("Playlist-ийг солих боломжгүй байна. Дахин ачаалж болно.");
      }
      return;
    }
    const options = [
      ...AMBIENTS.map((a) => `ambient:${a.id}`),
      ...sources.map((s) => s.id),
    ];
    const index = options.indexOf(latest.current.selection);
    select(options[(index + direction + options.length) % options.length]);
  };
  const retry = () => {
    generation.current++;
    playWhenReady.current = false;
    mark("paused");
    commit({ ...capture(), playback: "paused" });
    setError("");
    setBusy(false);
    setActivated(true);
    setAttempt((a) => a + 1);
  };
  const add = async () => {
    let parsed;
    try {
      parsed = parseYouTube(url);
    } catch (e) {
      fail((e as Error).message);
      return;
    }
    const old = sources.find(
      (s) => s.kind === parsed.kind && s.youtubeId === parsed.youtubeId,
    );
    if (old) {
      select(old.id);
      return;
    }
    const now = Date.now();
    const newSource = {
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
    try {
      await store.mutate(
        (d) =>
          store.getSnapshot().namespace === namespace
            ? { ...d, musicSources: [...d.musicSources, newSource] }
            : d,
        { reportError: false, reportBusy: false },
      );
      if (!mounted.current || store.getSnapshot().namespace !== namespace)
        return;
      // The new source is not in this event's render snapshot yet.
      select(newSource.id);
      commit({
        track: {
          title: newSource.title,
          artist: "YouTube",
          videoId: parsed.kind === "video" ? parsed.youtubeId : null,
          url: youtubeURL(parsed),
        },
      });
      setUrl("");
      setTitle("");
    } catch {
      fail("YouTube холбоосыг хадгалж чадсангүй. Дахин оролдоно уу.");
    }
  };
  const remove = async (id: string) => {
    try {
      await store.mutate(
        (d) =>
          store.getSnapshot().namespace === namespace
            ? {
                ...d,
                musicSources: d.musicSources.map((s) =>
                  s.id === id
                    ? { ...s, deletedAt: Date.now(), updatedAt: Date.now() }
                    : s,
                ),
              }
            : d,
        { reportError: false, reportBusy: false },
      );
      if (!mounted.current || store.getSnapshot().namespace !== namespace)
        return;
      if (latest.current.selection === id) select("ambient:lofi", false);
    } catch {
      fail("Хөгжмийн холбоосыг устгаж чадсангүй.");
    }
  };
  useEffect(() => {
    mounted.current = true;
    generation.current++;
    return () => {
      mounted.current = false;
      playWhenReady.current = false;
      try {
        ambient.current?.close();
      } catch {}
      ambient.current = null;
      youtube.current = null;
      adapter.current = null;
    };
  }, [namespace]);
  useEffect(() => {
    try {
      adapter.current?.setVolume(volume, muted);
    } catch {
      const tick = setTimeout(
        () => fail("Дууны түвшинг тохируулж чадсангүй. Дахин ачаалж болно."),
        0,
      );
      return () => clearTimeout(tick);
    }
    // Only music preference changes affect the adapter; no timer/view dependency.
  }, [volume, muted]);
  const checkpoint = useRef(() => {});
  useEffect(() => {
    checkpoint.current = () => {
      if (actual.current === "playing") commit(capture());
    };
  });
  useEffect(() => {
    const tick = setInterval(() => checkpoint.current(), 15000);
    const save = () => checkpoint.current();
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(tick);
      window.removeEventListener("pagehide", save);
    };
  }, []);
  useMusicMediaSession({
    title: session.track.title,
    artist: session.track.artist,
    playback,
    play: () => {
      void play();
    },
    pause,
    stop,
    next: () => next(1),
    previous: () => next(-1),
  });
  return {
    data,
    volume,
    muted,
    savePreference: updatePreference,
    session,
    playback,
    playing: playback === "playing",
    activated,
    open: session.open,
    setOpen,
    selected,
    source,
    sources,
    isAmbient,
    name: session.track.title,
    error: error || storageError,
    busy,
    attempt,
    url,
    setUrl,
    title,
    setTitle,
    select,
    minimize: () => setOpen(false),
    toggle: () => {
      if (actual.current === "playing") pause();
      else void play();
    },
    stop,
    next,
    retry,
    add,
    remove,
    onReady,
    onState,
    onError,
  };
}
const MusicContext = createContext<ReturnType<
  typeof useMusicController
> | null>(null);
class MusicBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <aside
          className="music-player music-dock music-failed"
          aria-label="Study music"
        >
          <p role="alert">
            Хөгжим түр ажиллахгүй байна. Хичээлээ үргэлжлүүлж болно.
          </p>
          <button
            className="button small"
            onClick={() =>
              this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))
            }
          >
            Хөгжмийг дахин нээх
          </button>
        </aside>
      );
    return (
      <MusicController key={this.state.attempt}>
        {this.props.children}
      </MusicController>
    );
  }
}
function MusicController({ children }: { children: ReactNode }) {
  const controller = useMusicController();
  return (
    <MusicContext.Provider value={controller}>{children}</MusicContext.Provider>
  );
}
export function MusicProvider({ children }: { children: ReactNode }) {
  return <MusicBoundary>{children}</MusicBoundary>;
}
export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw Error("MusicProvider шаардлагатай.");
  return context;
}
