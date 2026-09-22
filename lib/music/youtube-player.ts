import type { MusicProvider } from "./provider";
import type { MusicSession } from "./preferences";
import type { YouTubeSource } from "./youtube";
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  setVolume(n: number): void;
  mute(): void;
  unMute(): void;
  nextVideo(): void;
  previousVideo(): void;
  destroy(): void;
  getPlayerState(): number;
  getCurrentTime?(): number;
  seekTo?(seconds: number, allowSeekAhead: boolean): void;
  getPlaylistIndex?(): number;
  getVideoUrl?(): string;
  getVideoData?(): { title?: string; author?: string; video_id?: string };
  cuePlaylist?(options: {
    list: string;
    listType: string;
    index: number;
    startSeconds: number;
  }): void;
}
interface YTEvent {
  target: YTPlayer;
  data?: number;
}
interface YTApi {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let loading: Promise<YTApi> | null = null;
export function loadYouTube(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  const request = new Promise<YTApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    let settled = false;
    const script = document.createElement("script");
    const cleanup = () => {
      clearTimeout(timer);
      script.onerror = null;
      if (window.onYouTubeIframeAPIReady === ready)
        window.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(
        Error("YouTube холбогдсонгүй. Интернетээ шалгаад дахин оролдоно уу."),
      );
    };
    const ready = () => {
      if (settled) return;
      // A different embed's callback must not escape into the app's global error handler.
      try {
        previous?.();
      } catch {
        /* This player can still initialize. */
      }
      if (!window.YT?.Player) {
        fail();
        return;
      }
      settled = true;
      cleanup();
      resolve(window.YT);
    };
    const timer = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = ready;
    document.querySelector("script[data-togtmol-youtube]")?.remove();
    script.src = "https://www.youtube.com/iframe_api";
    script.dataset.togtmolYoutube = "true";
    script.async = true;
    script.onerror = fail;
    try {
      document.head.append(script);
    } catch {
      fail();
    }
  });
  loading = request;
  void request.catch(() => {
    if (loading === request) loading = null;
  });
  return request;
}
export function mountYouTube(
  api: YTApi,
  element: HTMLElement,
  source: YouTubeSource,
  handlers: {
    ready: (p: YTPlayer) => void;
    state: (state: number) => void;
    error: (message: string) => void;
  },
  resume?: Pick<MusicSession, "position" | "playlistIndex">,
) {
  const report = (message: string) => {
    try {
      handlers.error(message);
    } catch {
      /* Never throw from a third-party callback. */
    }
  };
  const safely = (action: () => void) => {
    try {
      action();
    } catch {
      report("YouTube удирдлага тасарлаа. Дахин ачаалж болно.");
    }
  };
  return new api.Player(element, {
    width: "100%",
    height: "220",
    ...(source.kind === "video" ? { videoId: source.youtubeId } : {}),
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      origin: window.location.origin,
      ...(source.kind === "video" && resume?.position
        ? { start: Math.floor(resume.position) }
        : {}),
      ...(source.kind === "playlist"
        ? { listType: "playlist", list: source.youtubeId }
        : {}),
    },
    events: {
      onReady: (e: YTEvent) =>
        safely(() => {
          if (
            source.kind === "playlist" &&
            resume &&
            (resume.playlistIndex || resume.position)
          ) {
            e.target.cuePlaylist?.({
              list: source.youtubeId,
              listType: "playlist",
              index: resume.playlistIndex,
              startSeconds: resume.position,
            });
          }
          handlers.ready(e.target);
        }),
      onStateChange: (e: YTEvent) => safely(() => handlers.state(e.data ?? -1)),
      onError: (e: YTEvent) =>
        report(
          [100, 101, 150].includes(e.data ?? 0)
            ? "Энэ бичлэгийг энд тоглуулах боломжгүй. Өөр холбоос сонгоорой."
            : "YouTube тоглуулж чадсангүй. Бичлэг доторх Play-г дарж үзнэ үү.",
        ),
      onAutoplayBlocked: () =>
        report(
          "Браузер дууг түр хаалаа. YouTube бичлэг доторх Play-г дараарай.",
        ),
    },
  });
}
export function youtubeProvider(player: YTPlayer): MusicProvider {
  return {
    kind: "youtube",
    requiresVisiblePlayer: true,
    play: async () => player.playVideo(),
    pause: async () => player.pauseVideo(),
    stop: async () => player.stopVideo(),
    setVolume: (value, muted) => {
      player.setVolume(Math.round(Math.min(1, Math.max(0, value)) * 100));
      if (muted) player.mute();
      else player.unMute();
    },
    next: () => player.nextVideo(),
    previous: () => player.previousVideo(),
  };
}
