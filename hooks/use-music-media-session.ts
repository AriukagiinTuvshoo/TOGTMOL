"use client";
import { useEffect, useRef } from "react";
import type { PlaybackState } from "@/lib/music/preferences";

export function useMusicMediaSession({
  title,
  artist,
  playback,
  position,
  duration,
  play,
  pause,
  stop,
  next,
  previous,
}: {
  title: string;
  artist: string;
  playback: PlaybackState;
  position?: number;
  duration?: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
}) {
  const actions = useRef({ play, pause, stop, next, previous });
  useEffect(() => {
    actions.current = { play, pause, stop, next, previous };
  }, [play, pause, stop, next, previous]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, () => void][] = [
      ["play", () => actions.current.play()],
      ["pause", () => actions.current.pause()],
      ["stop", () => actions.current.stop()],
      ["nexttrack", () => actions.current.next()],
      ["previoustrack", () => actions.current.previous()],
    ];
    for (const [name, handler] of handlers) {
      try {
        session.setActionHandler(name, handler);
      } catch {
        /* Unsupported action/browser. */
      }
    }
    return () => {
      for (const [name] of handlers) {
        try {
          session.setActionHandler(name, null);
        } catch {}
      }
      try {
        session.metadata = null;
        session.playbackState = "none";
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      if (typeof MediaMetadata !== "undefined")
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album: "Тогтмол",
        });
      navigator.mediaSession.playbackState =
        playback === "stopped" ? "none" : playback;
      if (
        typeof navigator.mediaSession.setPositionState === "function" &&
        Number.isFinite(duration) &&
        Number(duration) > 0 &&
        Number.isFinite(position) &&
        Number(position) >= 0 &&
        Number(position) <= Number(duration)
      ) {
        navigator.mediaSession.setPositionState({
          duration: Number(duration),
          playbackRate: 1,
          position: Number(position),
        });
      }
    } catch {
      /* Media controls are optional; they never own the audio lifecycle. */
    }
  }, [title, artist, playback, position, duration]);
}
