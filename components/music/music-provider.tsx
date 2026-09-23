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
import { isVideoMedia, parseAudioURL } from "@/lib/music/native-audio";
import { uid } from "@/lib/constants";
import type { MusicSource } from "@/types/study";

const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|ogg|oga|opus|aac|flac|webm|mp4)$/i;

function isAudioFile(file: File) {
  return (
    file.type.startsWith("audio/") ||
    file.type === "video/mp4" ||
    AUDIO_EXTENSIONS.test(file.name)
  );
}

function sourceTrack(
  source: MusicSource | undefined,
  fallback = "Хөгжим",
  selection = "",
) {
  if (!source) {
    const ambient = AMBIENTS.find((a) => `ambient:${a.id}` === selection);
    return {
      title: ambient?.name ?? fallback,
      artist: ambient ? "Тогтмол · Study Sounds" : "Тогтмол",
      videoId: null,
      url: "",
    };
  }
  if (source.kind === "audio") {
    return {
      title: source.title,
      artist: source.audioStorageKey ? "Төхөөрөмжийн файл" : "Аудио холбоос",
      videoId: null,
      url: source.audioUrl ?? "",
    };
  }
  if (source.kind === "video" || source.kind === "playlist") {
    return {
      title: source.title,
      artist: "YouTube",
      videoId: source.kind === "video" ? source.youtubeId : null,
      url: youtubeURL(
        source as { kind: "video" | "playlist"; youtubeId: string },
      ),
    };
  }
  return { title: fallback, artist: "Хөгжим", videoId: null, url: "" };
}

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
        track: sourceTrack(source, "Хөгжим", selection),
      }
    );
  });
  const [playback, setPlayback] = useState<PlaybackState>(
    session.playback === "stopped" ? "stopped" : "paused",
  );
  const [activated, setActivated] = useState(
    session.open || session.playback !== "stopped",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const latest = useRef(session);
  const actual = useRef(playback);
  const mounted = useRef(true);
  const generation = useRef(0);
  const playWhenReady = useRef(false);
  const ambient = useRef<AmbientPlayer | null>(null);
  const youtube = useRef<YTPlayer | null>(null);
  const adapter = useRef<MusicAdapter | null>(null);
  const nativeAudio = useRef<HTMLMediaElement | null>(null);
  const nativeSourceId = useRef<string | null>(null);
  const nativeObjectURL = useRef<string | null>(null);
  const nativeVideoHost = useRef<HTMLElement | null>(null);
  const [mediaPosition, setMediaPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);

  const sources = data.musicSources.filter((s) => !s.deletedAt);
  const selected = session.selection;
  const source = sources.find((s) => s.id === selected);
  const isAmbient = selected.startsWith("ambient:");
  const { volume, muted, autoNext, repeat, seekSeconds } = preference;

  const currentSources = () =>
    store.getSnapshot().data.musicSources.filter((s) => !s.deletedAt);

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

  const attachNativeVideoHost = (host: HTMLElement | null) => {
    nativeVideoHost.current = host;
    const element = nativeAudio.current;
    if (element instanceof HTMLVideoElement) {
      if (host && element.parentElement !== host) {
        host.append(element);
        element.style.display = "";
      } else if (!host) {
        element.style.display = "none";
      }
    }
  };

  const ensureNativeAudio = (target?: MusicSource) => {
    const wantVideo = target
      ? isVideoMedia(target.audioUrl, target.mimeType)
      : false;
    if (nativeAudio.current) {
      const existingIsVideo = nativeAudio.current instanceof HTMLVideoElement;
      if (existingIsVideo === wantVideo) {
        if (
          existingIsVideo &&
          nativeVideoHost.current &&
          nativeAudio.current.parentElement !== nativeVideoHost.current
        ) {
          nativeVideoHost.current.append(nativeAudio.current);
          nativeAudio.current.style.display = "";
        }
        return nativeAudio.current;
      }
      try {
        nativeAudio.current.pause();
      } catch {}
      nativeAudio.current.removeAttribute("src");
      nativeAudio.current.load();
      nativeAudio.current = null;
    }
    const element: HTMLMediaElement = wantVideo
      ? document.createElement("video")
      : new Audio();
    if (wantVideo) {
      const video = element as HTMLVideoElement;
      video.playsInline = true;
      video.controls = false;
      video.className = "music-native-video";
      if (nativeVideoHost.current) {
        nativeVideoHost.current.append(video);
      } else {
        video.style.display = "none";
        document.body.appendChild(video);
      }
    }
    element.preload = "metadata";
    try {
      const audioSession = (
        navigator as Navigator & {
          audioSession?: { type: string };
        }
      ).audioSession;
      if (audioSession) audioSession.type = "playback";
    } catch {
      /* Audio Session is optional. */
    }
    nativeAudio.current = element;
    return element;
  };

  const revokeNativeURL = () => {
    if (nativeObjectURL.current) {
      URL.revokeObjectURL(nativeObjectURL.current);
      nativeObjectURL.current = null;
    }
  };

  const loadNativeSource = async (
    target: MusicSource,
    resumePosition: number,
  ) => {
    if (target.kind !== "audio") throw Error("Аудио эх сурвалж буруу.");
    const wantVideo = isVideoMedia(target.audioUrl, target.mimeType);
    const element = ensureNativeAudio(target);
    const targetId = target.id;
    let nextURL = target.audioUrl ?? "";
    if (target.audioStorageKey) {
      const blob = await store.repository.loadMusicBlob(
        namespace,
        target.audioStorageKey,
      );
      if (!blob) throw Error("Төхөөрөмж дээрх энэ аудио файл олдсонгүй.");
      nextURL = URL.createObjectURL(blob);
    }
    if (!nextURL) throw Error("Аудио холбоос олдсонгүй.");
    if (nativeSourceId.current !== targetId) {
      element.pause();
      revokeNativeURL();
      nativeSourceId.current = targetId;
      nativeObjectURL.current = target.audioStorageKey ? nextURL : null;
      element.src = nextURL;
      element.load();
    }
    if (Number.isFinite(resumePosition) && resumePosition > 0) {
      try {
        if (element.readyState < 1) {
          await new Promise<void>((resolve, reject) => {
            const done = () => {
              cleanup();
              resolve();
            };
            const failed = () => {
              cleanup();
              reject(Error("Аудиог уншиж чадсангүй."));
            };
            const cleanup = () => {
              element.removeEventListener("loadedmetadata", done);
              element.removeEventListener("error", failed);
            };
            element.addEventListener("loadedmetadata", done, { once: true });
            element.addEventListener("error", failed, { once: true });
          });
        }
        if (Number.isFinite(element.duration))
          element.currentTime = Math.min(
            resumePosition,
            Math.max(0, element.duration - 0.25),
          );
      } catch {
        /* Starting from the beginning is safer than blocking playback. */
      }
    }
    element.volume = muted ? 0 : volume;
    if (wantVideo && nativeVideoHost.current) {
      nativeVideoHost.current.append(element);
      element.style.display = "";
    }
    return element;
  };

  const capture = (): MusicSession => {
    let current = latest.current;
    const element = nativeAudio.current;
    if (
      current.selection === nativeSourceId.current &&
      element &&
      latest.current.selection !== ""
    ) {
      return normalizeMusicSession({
        ...current,
        position:
          actual.current === "stopped"
            ? 0
            : Number.isFinite(element.currentTime)
              ? element.currentTime
              : current.position,
      })!;
    }
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
      if (
        nativeSourceId.current === latest.current.selection &&
        nativeAudio.current
      ) {
        if (kind === "stop") nativeAudio.current.currentTime = 0;
        nativeAudio.current.pause();
        return;
      }
      const target = adapter.current;
      void target?.[kind]().catch(() => {
        if (adapter.current === target)
          fail("Хөгжмийн удирдлага тасарлаа. Дахин оролдоно уу.");
      });
    } catch {
      fail("Хөгжмийн удирдлага тасарлаа. Дахин оролдоно уу.");
    }
  };

  const pause = () => control("pause");
  const stop = () => control("stop");

  const seekBy = (delta: number) => {
    const native = nativeAudio.current;
    if (nativeSourceId.current === latest.current.selection && native) {
      const nextTime = Math.max(
        0,
        Math.min(
          Number.isFinite(native.duration) ? native.duration : Infinity,
          native.currentTime + delta,
        ),
      );
      native.currentTime = nextTime;
      setMediaPosition(nextTime);
      commit({ ...capture(), position: nextTime });
      return;
    }
    if (youtube.current && !latest.current.selection.startsWith("ambient:")) {
      const current = youtube.current.getCurrentTime?.() ?? latest.current.position;
      const nextTime = Math.max(0, current + delta);
      youtube.current.seekTo?.(nextTime, true);
      setMediaPosition(nextTime);
      commit({ ...capture(), position: nextTime });
    }
  };

  const seekTo = (time: number) => {
    const native = nativeAudio.current;
    if (nativeSourceId.current === latest.current.selection && native) {
      const nextTime = Math.max(
        0,
        Math.min(Number.isFinite(native.duration) ? native.duration : Infinity, time),
      );
      native.currentTime = nextTime;
      setMediaPosition(nextTime);
      commit({ ...capture(), position: nextTime });
      return;
    }
    if (youtube.current && !latest.current.selection.startsWith("ambient:")) {
      const duration = youtube.current.getDuration?.() ?? Infinity;
      const nextTime = Math.max(0, Math.min(duration, time));
      youtube.current.seekTo?.(nextTime, true);
      setMediaPosition(nextTime);
      commit({ ...capture(), position: nextTime });
    }
  };

  const play = async (id = latest.current.selection) => {
    if (actual.current === "playing" && id === latest.current.selection) return;
    setError("");
    const token = ++generation.current;
    const target = currentSources().find((s) => s.id === id);

    if (target?.kind === "audio") {
      setBusy(true);
      try {
        const element = await loadNativeSource(
          target,
          actual.current === "stopped" ? 0 : latest.current.position,
        );
        if (!mounted.current || token !== generation.current) return;
        await element.play();
        if (!mounted.current || token !== generation.current) return;
        mark("playing");
        commit({ playback: "playing" });
      } catch (e) {
        if (token === generation.current)
          fail(e instanceof Error ? e.message : "Аудиог тоглуулж чадсангүй.");
      } finally {
        if (mounted.current && token === generation.current) setBusy(false);
      }
      return;
    }

    if (!id.startsWith("ambient:")) {
      if (!youtube.current || adapter.current?.kind !== "youtube") {
        playWhenReady.current = true;
        setActivated(true);
        setBusy(true);
        return;
      }
      try {
        const targetAdapter = adapter.current;
        if (actual.current === "stopped") youtube.current?.seekTo?.(0, true);
        await targetAdapter.play();
        if (!mounted.current || token !== generation.current) return;
      } catch {
        fail("YouTube-г тоглуулж чадсангүй. Дахин оролдоно уу.");
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
      const targetAdapter = ambientProvider(engine, id.slice(8) as AmbientId);
      adapter.current = targetAdapter;
      targetAdapter.setVolume(volume, muted);
      await targetAdapter.play();
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
    setMediaPosition(0);
    setMediaDuration(0);
    playWhenReady.current = false;
    try {
      adapter.current?.pause().catch(() => {});
    } catch {}
    if (nativeSourceId.current !== id) {
      try {
        nativeAudio.current?.pause();
      } catch {}
    }
    adapter.current = null;
    youtube.current = null;
    mark("paused");
    setBusy(false);
    setError("");
    const target = currentSources().find((s) => s.id === id);
    commit({
      selection: id,
      playback: resume ? "playing" : "stopped",
      position: 0,
      playlistIndex: 0,
      track: target
        ? sourceTrack(target)
        : {
            title:
              AMBIENTS.find((a) => `ambient:${a.id}` === id)?.name ?? "Хөгжим",
            artist: "Тогтмол",
            videoId: null,
            url: "",
          },
    });
    setActivated(true);
    if (resume) {
      if (id.startsWith("ambient:")) void play(id);
      else if (target?.kind === "audio") void play(id);
      else playWhenReady.current = true;
    } else {
      mark("stopped");
        if (target?.kind === "audio" && isVideoMedia(target.audioUrl, target.mimeType)) {
        void loadNativeSource(target, 0).catch((e) =>
          fail(e instanceof Error ? e.message : "MP4 бичлэгийг ачаалж чадсангүй."),
        );
      }
    }
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
    else if (state === 0) {
      if (repeat && youtube.current) {
        youtube.current.seekTo?.(0, true);
        void youtubeProvider(youtube.current)
          .play()
          .then(() => mark("playing"))
          .catch(() => fail("Давталтыг эхлүүлж чадсангүй."));
        return;
      }
      if (autoNext) {
        next(1);
        return;
      }
      mark("stopped");
    } else return;
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
    const target = currentSources().find(
      (s) => s.id === latest.current.selection,
    );
    if (target?.kind === "playlist" && adapter.current?.kind === "youtube") {
      try {
        if (direction > 0) adapter.current.next?.();
        else adapter.current.previous?.();
      } catch {
        fail("Playlist-ийг солих боломжгүй байна. Дахин оролдоно уу.");
      }
      return;
    }
    const options = [
      ...AMBIENTS.map((a) => `ambient:${a.id}`),
      ...currentSources().map((s) => s.id),
    ];
    if (!options.length) return;
    const index = options.indexOf(latest.current.selection);
    select(options[(index + direction + options.length) % options.length]);
  };

  const retry = () => {
    generation.current++;
    playWhenReady.current = false;
    mark("paused");
    setError("");
    setBusy(false);
    setActivated(true);
    setAttempt((a) => a + 1);
    void play();
  };

  const addURL = async () => {
    const input = url.trim();
    if (!input) return;
    try {
      let parsedYouTube;
      try {
        parsedYouTube = parseYouTube(input);
      } catch {
        parsedYouTube = null;
      }

      if (parsedYouTube) {
        const old = currentSources().find(
          (s) =>
            s.kind === parsedYouTube.kind &&
            s.youtubeId === parsedYouTube.youtubeId,
        );
        if (old) {
          select(old.id, false);
          await play(old.id);
          setUrl("");
          setTitle("");
          return;
        }
        const now = Date.now();
        const newSource: MusicSource = {
          ...parsedYouTube,
          id: uid("music"),
          title:
            title.trim().slice(0, 120) ||
            (parsedYouTube.kind === "playlist"
              ? "Миний YouTube playlist"
              : "Миний YouTube бичлэг"),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          extras: {},
        };
        await store.mutate(
          (d) =>
            store.getSnapshot().namespace === namespace
              ? { ...d, musicSources: [...d.musicSources, newSource] }
              : d,
          { reportError: false, reportBusy: false },
        );
        commit({
          selection: newSource.id,
          playback: "stopped",
          position: 0,
          playlistIndex: 0,
          track: sourceTrack(newSource),
        });
        setActivated(true);
        setUrl("");
        setTitle("");
        return;
      }

      const audioUrl = parseAudioURL(input);
      const old = currentSources().find(
        (s) => s.kind === "audio" && s.audioUrl === audioUrl,
      );
      if (old) {
        select(old.id, false);
        await play(old.id);
        setUrl("");
        setTitle("");
        return;
      }
      const now = Date.now();
      const newSource: MusicSource = {
        id: uid("music"),
        title: title.trim().slice(0, 120) || "Миний аудио",
        kind: "audio",
        youtubeId: "",
        audioUrl,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        extras: {},
      };
      await store.mutate(
        (d) =>
          store.getSnapshot().namespace === namespace
            ? { ...d, musicSources: [...d.musicSources, newSource] }
            : d,
        { reportError: false, reportBusy: false },
      );
      commit({
        selection: newSource.id,
        playback: "stopped",
        position: 0,
        playlistIndex: 0,
        track: sourceTrack(newSource),
      });
      setActivated(true);
      if (isVideoMedia(newSource.audioUrl, newSource.mimeType)) {
        void loadNativeSource(newSource, 0).catch((e) =>
          fail(e instanceof Error ? e.message : "MP4 бичлэгийг ачаалж чадсангүй."),
        );
      }
      setUrl("");
      setTitle("");
    } catch (e) {
      fail(e instanceof Error ? e.message : "Холбоосыг хадгалж чадсангүй.");
    }
  };

  const addFile = async (file: File | null) => {
    if (!file) return;
    if (!isAudioFile(file)) {
      fail("Зөвхөн аудио эсвэл MP4 видео файл сонгоно уу.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      fail("Аудио файл 1 байтаас 80 MB хүртэл байна.");
      return;
    }
    if (store.repository.fallback) {
      fail(
        "Төхөөрөмжийн аудио файл хадгалахад IndexedDB дэмждэг браузер хэрэгтэй.",
      );
      return;
    }
    const key = uid("musicblob");
    const now = Date.now();
    const newSource: MusicSource = {
      id: uid("music"),
      title: title.trim().slice(0, 120) || file.name.replace(/\.[^.]+$/, ""),
      kind: "audio",
      youtubeId: "",
      audioStorageKey: key,
      mimeType: file.type || "audio/*",
      sizeBytes: file.size,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      extras: {},
    };
    setBusy(true);
    try {
      await store.repository.saveMusicBlob(namespace, key, file);
      try {
        await store.mutate(
          (d) =>
            store.getSnapshot().namespace === namespace
              ? { ...d, musicSources: [...d.musicSources, newSource] }
              : d,
          { reportError: false, reportBusy: false },
        );
      } catch (error) {
        await store.repository.deleteMusicBlob(namespace, key).catch(() => {});
        throw error;
      }
      commit({
        selection: newSource.id,
        playback: "stopped",
        position: 0,
        playlistIndex: 0,
        track: sourceTrack(newSource),
      });
      setActivated(true);
      if (isVideoMedia(newSource.audioUrl, newSource.mimeType)) {
        void loadNativeSource(newSource, 0).catch((e) =>
          fail(e instanceof Error ? e.message : "MP4 бичлэгийг ачаалж чадсангүй."),
        );
      }
      setTitle("");
      setUrl("");
    } catch (e) {
      fail(e instanceof Error ? e.message : "Аудио файлыг хадгалж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const target = currentSources().find((s) => s.id === id);
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
      if (target?.kind === "audio" && target.audioStorageKey)
        await store.repository.deleteMusicBlob(
          namespace,
          target.audioStorageKey,
        );
      if (!mounted.current || store.getSnapshot().namespace !== namespace)
        return;
      if (latest.current.selection === id) select("ambient:lofi", false);
    } catch {
      fail("Хөгжмийг устгаж чадсангүй.");
    }
  };

  useEffect(() => {
    const element = nativeAudio.current;
    if (!element) return;
    const handlePlay = () => {
      if (nativeSourceId.current !== latest.current.selection) return;
      mark("playing");
      setBusy(false);
      commit({ playback: "playing" });
    };
    const handlePause = () => {
      if (
        nativeSourceId.current !== latest.current.selection ||
        actual.current === "stopped"
      )
        return;
      mark("paused");
      setBusy(false);
      commit({ ...capture(), playback: "paused" });
    };
    const handleEnded = () => {
      if (nativeSourceId.current !== latest.current.selection) return;
      if (repeat && nativeAudio.current) {
        nativeAudio.current.currentTime = 0;
        void nativeAudio.current
          .play()
          .then(() => {
            mark("playing");
            setBusy(false);
            commit({ playback: "playing", position: 0 });
          })
          .catch(() => fail("Давталтыг эхлүүлж чадсангүй."));
        return;
      }
      if (autoNext) {
        next(1);
        return;
      }
      mark("stopped");
      setMediaPosition(0);
      setBusy(false);
      commit({ ...capture(), playback: "stopped", position: 0 });
    };
    const handleError = () => {
      if (nativeSourceId.current !== latest.current.selection) return;
      mark("paused");
      fail("Энэ аудиог тоглуулж чадсангүй. Файлаа эсвэл холбоосоо шалгана уу.");
    };
    const handleLoadedMetadata = () => {
      setMediaDuration(
        Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0,
      );
    };
    element.addEventListener("play", handlePlay);
    element.addEventListener("pause", handlePause);
    element.addEventListener("ended", handleEnded);
    element.addEventListener("error", handleError);
    element.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      element.removeEventListener("play", handlePlay);
      element.removeEventListener("pause", handlePause);
      element.removeEventListener("ended", handleEnded);
      element.removeEventListener("error", handleError);
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  });

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (actual.current !== "playing") return;
      const native = nativeAudio.current;
      if (
        nativeSourceId.current === latest.current.selection &&
        native
      ) {
        setMediaPosition(
          Number.isFinite(native.currentTime) ? Math.max(0, native.currentTime) : 0,
        );
        setMediaDuration(
          Number.isFinite(native.duration) ? Math.max(0, native.duration) : 0,
        );
        return;
      }
      const yt = youtube.current;
      if (yt) {
        setMediaPosition(yt.getCurrentTime?.() ?? latest.current.position);
        setMediaDuration(yt.getDuration?.() ?? 0);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    try {
      adapter.current?.setVolume(volume, muted);
      if (nativeAudio.current) nativeAudio.current.volume = muted ? 0 : volume;
    } catch {
      const tick = setTimeout(
        () => fail("Дууны түвшинг тохируулж чадсангүй. Дахин оролдоно уу."),
        0,
      );
      return () => clearTimeout(tick);
    }
  }, [volume, muted]);

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    return () => {
      mounted.current = false;
      playWhenReady.current = false;
      try {
        nativeAudio.current?.pause();
        nativeAudio.current?.removeAttribute("src");
        nativeAudio.current?.load();
        if (nativeAudio.current instanceof HTMLVideoElement) {
          nativeAudio.current.remove();
        }
      } catch {}
      revokeNativeURL();
      nativeSourceId.current = null;
      try {
        ambient.current?.close();
      } catch {}
      ambient.current = null;
      youtube.current = null;
      adapter.current = null;
    };
  }, [namespace]);

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
    isNativeAudio: source?.kind === "audio",
    name: session.track.title,
    error: error || storageError,
    busy,
    autoNext,
    repeat,
    seekSeconds,
    currentTime: mediaPosition,
    duration: mediaDuration,
    canSeek: source?.kind === "audio" || source?.kind === "video" || source?.kind === "playlist",
    seekBy,
    seekTo,
    isVideoMedia: source?.kind === "audio" && isVideoMedia(source.audioUrl, source.mimeType),
    setNativeVideoHost: attachNativeVideoHost,
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
    addURL,
    addFile,
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
