"use client";
import { useEffect, useRef } from "react";
import {
  loadYouTube,
  mountYouTube,
  type YTPlayer,
} from "@/lib/music/youtube-player";
import type { YouTubeSource } from "@/lib/music/youtube";
import type { MusicSession } from "@/lib/music/preferences";
export function YouTubeEmbed({
  source,
  resume,
  onReady,
  onState,
  onError,
}: {
  source: YouTubeSource;
  resume?: Pick<MusicSession, "position" | "playlistIndex">;
  onReady: (player: YTPlayer | null) => void;
  onState: (state: number) => void;
  onError: (message: string) => void;
}) {
  const { kind, youtubeId } = source;
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onState, onError, resume });
  useEffect(() => {
    callbacks.current = { onReady, onState, onError, resume };
  }, [onReady, onState, onError, resume]);
  useEffect(() => {
    let disposed = false,
      player: YTPlayer | undefined;
    const container = host.current;
    if (!container) return;
    const element = document.createElement("div");
    container.append(element);
    const report = (message: string) => {
      if (!disposed) {
        try {
          callbacks.current.onError(message);
        } catch {
          /* Isolate asynchronous callbacks. */
        }
      }
    };
    void loadYouTube()
      .then((api) => {
        if (disposed) return;
        player = mountYouTube(
          api,
          element,
          { kind, youtubeId },
          {
            ready: (p) => {
              if (disposed) return;
              try {
                callbacks.current.onReady(p);
              } catch {
                report("YouTube удирдлагыг дахин ачаална уу.");
              }
            },
            state: (s) => {
              if (!disposed) {
                try {
                  callbacks.current.onState(s);
                } catch {
                  report("YouTube төлөвийг уншиж чадсангүй.");
                }
              }
            },
            error: report,
          },
          callbacks.current.resume,
        );
      })
      .catch(() =>
        report(
          "YouTube-г ачаалж чадсангүй. Интернетээ шалгаад дахин оролдоно уу.",
        ),
      );
    // Only a source change, explicit retry or app/account exit destroys the iframe.
    // Minimize, navigation, intersection and page visibility are not dependencies.
    return () => {
      disposed = true;
      try {
        callbacks.current.onReady(null);
      } catch {
        /* Already detached. */
      }
      try {
        player?.destroy();
      } catch {
        /* YouTube may already have removed the iframe. */
      }
      container.replaceChildren();
    };
  }, [kind, youtubeId]);
  return (
    <div ref={host} className="youtube-embed" aria-label="YouTube тоглуулагч" />
  );
}
