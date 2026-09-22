import type { DesignTheme, MusicSource } from "@/types/study";
import { AMBIENTS, THEME_MUSIC, type AmbientId } from "./catalog";
import { parseYouTube } from "./youtube";
export type PlaybackState = "playing" | "paused" | "stopped";
export interface MusicSession {
  selection: string;
  open: boolean;
  playback: PlaybackState;
  position: number;
  playlistIndex: number;
  track: { title: string; artist: string; videoId: string | null; url: string };
}
export interface MusicPreferences {
  volume: number;
  muted: boolean;
  defaultCategory: AmbientId | "theme";
  rememberLast: boolean;
  lastPlayed: string | null;
  session: MusicSession | null;
}
export const MUSIC_PREFERENCE_EVENT = "togtmol:music-preference";
export const musicPreferenceKey = (namespace: string) =>
  `togtmol:music:${namespace}`;
export function normalizeMusicSession(raw: unknown): MusicSession | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.selection !== "string" ||
    !value.selection ||
    value.selection.length > 200
  )
    return null;
  const track =
    value.track && typeof value.track === "object"
      ? (value.track as Record<string, unknown>)
      : {};
  let url = "";
  try {
    if (typeof track.url === "string" && track.url.length <= 2048) {
      parseYouTube(track.url);
      url = track.url;
    }
  } catch {
    /* Imported metadata must not create arbitrary links. */
  }
  return {
    selection: value.selection,
    open: value.open === true,
    playback:
      value.playback === "playing" || value.playback === "paused"
        ? value.playback
        : "stopped",
    position:
      typeof value.position === "number" && Number.isFinite(value.position)
        ? Math.max(0, value.position)
        : 0,
    playlistIndex:
      typeof value.playlistIndex === "number" &&
      Number.isSafeInteger(value.playlistIndex)
        ? Math.max(0, value.playlistIndex)
        : 0,
    track: {
      title: typeof track.title === "string" ? track.title.slice(0, 200) : "",
      artist:
        typeof track.artist === "string" ? track.artist.slice(0, 120) : "",
      videoId:
        typeof track.videoId === "string" &&
        /^[a-zA-Z0-9_-]{11}$/.test(track.videoId)
          ? track.videoId
          : null,
      url,
    },
  };
}
export function normalizeMusicPreference(raw: unknown): MusicPreferences {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    volume:
      typeof value.volume === "number" && Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : 0.4,
    muted: value.muted === true,
    defaultCategory: AMBIENTS.some((a) => a.id === value.defaultCategory)
      ? (value.defaultCategory as AmbientId)
      : "theme",
    rememberLast: value.rememberLast !== false,
    session: normalizeMusicSession(value.session),
    lastPlayed:
      typeof value.lastPlayed === "string" && value.lastPlayed.length <= 200
        ? value.lastPlayed
        : null,
  };
}
export function readMusicPreference(namespace: string) {
  try {
    return normalizeMusicPreference(
      JSON.parse(localStorage.getItem(musicPreferenceKey(namespace)) ?? "null"),
    );
  } catch {
    return normalizeMusicPreference(null);
  }
}
export function initialMusicSelection(
  preference: MusicPreferences,
  design: DesignTheme,
  sources: MusicSource[],
) {
  const last = preference.session?.selection ?? preference.lastPlayed;
  if (
    preference.rememberLast &&
    last &&
    (AMBIENTS.some((a) => `ambient:${a.id}` === last) ||
      sources.some((s) => !s.deletedAt && s.id === last))
  )
    return last;
  return `ambient:${preference.defaultCategory === "theme" ? THEME_MUSIC[design][0] : preference.defaultCategory}`;
}
