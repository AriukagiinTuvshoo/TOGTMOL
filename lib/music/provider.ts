/** Playback is independent of the study timer and persistence layer. */
export interface MusicProvider {
  kind: "ambient" | "youtube";
  requiresVisiblePlayer: boolean;
  play(): Promise<void>;
  pause(): Promise<void>;
  setVolume(volume: number, muted: boolean): void;
  next?(): void;
  previous?(): void;
}
