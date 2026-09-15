"use client";
import { useEffect, useRef } from "react";
import {
  loadYouTube,
  mountYouTube,
  type YTPlayer,
} from "@/lib/music/youtube-player";
import type { YouTubeSource } from "@/lib/music/youtube";
export function YouTubeEmbed({
  source,
  onReady,
  onState,
  onError,
}: {
  source: YouTubeSource;
  onReady: (player: YTPlayer | null) => void;
  onState: (state: number) => void;
  onError: (message: string) => void;
}) {
  const { kind, youtubeId } = source;
  const host = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onReady, onState, onError });
  useEffect(() => {
    callbacks.current = { onReady, onState, onError };
  }, [onReady, onState, onError]);
  useEffect(() => {
    let disposed = false,
      player: YTPlayer | undefined;
    let observer: IntersectionObserver | undefined;
    const element = document.createElement("div");
    host.current!.append(element);
    void loadYouTube()
      .then((api) => {
        if (disposed) return;
        player = mountYouTube(
          api,
          element,
          { kind, youtubeId },
          {
            ready: (p) => {
              if (disposed) {
                p.destroy();
                return;
              }
              callbacks.current.onReady(p);
              if (typeof IntersectionObserver !== "undefined" && host.current) {
                observer = new IntersectionObserver(
                  (entries) => {
                    if (entries.some((entry) => !entry.isIntersecting))
                      p.pauseVideo();
                  },
                  { threshold: 0.1 },
                );
                observer.observe(host.current);
              }
            },
            state: (s) => callbacks.current.onState(s),
            error: (m) => callbacks.current.onError(m),
          },
        );
      })
      .catch((e) => {
        if (!disposed)
          callbacks.current.onError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      callbacks.current.onReady(null);
      player?.destroy();
      element.remove();
    };
  }, [kind, youtubeId]);
  return (
    <div ref={host} className="youtube-embed" aria-label="YouTube тоглуулагч" />
  );
}
