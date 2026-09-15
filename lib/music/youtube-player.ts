import type { MusicProvider } from "./provider";
import type { YouTubeSource } from "./youtube";
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  setVolume(n: number): void;
  mute(): void;
  unMute(): void;
  nextVideo(): void;
  previousVideo(): void;
  destroy(): void;
  getPlayerState(): number;
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
  loading = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => {
      loading = null;
      reject(
        Error("YouTube холбогдсонгүй. Интернетээ шалгаад дахин оролдоно уу."),
      );
    }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timer);
      if (window.YT) resolve(window.YT);
    };
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-togtmol-youtube]",
    );
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.dataset.togtmolYoutube = "true";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      loading = null;
      script.remove();
      reject(Error("YouTube-г ачаалж чадсангүй. Дахин оролдоно уу."));
    };
    document.head.append(script);
  });
  return loading;
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
) {
  // Official player stays visible while playing. No background audio extraction.
  return new api.Player(element, {
    width: "100%",
    height: "220",
    ...(source.kind === "video" ? { videoId: source.youtubeId } : {}),
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      origin: window.location.origin,
      ...(source.kind === "playlist"
        ? { listType: "playlist", list: source.youtubeId }
        : {}),
    },
    events: {
      onReady: (e: YTEvent) => handlers.ready(e.target),
      onStateChange: (e: YTEvent) => handlers.state(e.data ?? -1),
      onError: (e: YTEvent) =>
        handlers.error(
          [100, 101, 150].includes(e.data ?? 0)
            ? "Энэ бичлэгийг энд тоглуулах боломжгүй. Өөр холбоос сонгоорой."
            : "YouTube тоглуулж чадсангүй. Бичлэг доторх Play-г дарж үзнэ үү.",
        ),
      onAutoplayBlocked: () =>
        handlers.error(
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
    setVolume: (value, muted) => {
      player.setVolume(Math.min(1, Math.max(0, value)) * 100);
      if (muted) player.mute();
      else player.unMute();
    },
    next: () => player.nextVideo(),
    previous: () => player.previousVideo(),
  };
}
