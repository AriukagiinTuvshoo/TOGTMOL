import type { DesignTheme, MusicSource } from "@/types/study";
import { AMBIENTS, THEME_MUSIC, type AmbientId } from "./catalog";
export interface MusicPreferences {
  volume: number;
  muted: boolean;
  defaultCategory: AmbientId | "theme";
  rememberLast: boolean;
  lastPlayed: string | null;
}
export const MUSIC_PREFERENCE_EVENT = "togtmol:music-preference";
export const musicPreferenceKey = (namespace: string) =>
  `togtmol:music:${namespace}`;
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
  const last = preference.lastPlayed;
  if (
    preference.rememberLast &&
    last &&
    (AMBIENTS.some((a) => `ambient:${a.id}` === last) ||
      sources.some((s) => !s.deletedAt && s.id === last))
  )
    return last;
  return `ambient:${preference.defaultCategory === "theme" ? THEME_MUSIC[design][0] : preference.defaultCategory}`;
}
