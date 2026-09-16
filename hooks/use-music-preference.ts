"use client";
import { useEffect, useRef, useState } from "react";
import {
  MUSIC_PREFERENCE_EVENT,
  musicPreferenceKey,
  normalizeMusicPreference,
  readMusicPreference,
  type MusicPreferences,
} from "@/lib/music/preferences";

export function useMusicPreference(namespace: string) {
  const [preference, setPreference] = useState(() =>
    readMusicPreference(namespace),
  );
  const latest = useRef(preference);
  useEffect(() => {
    const changed = (event: Event) => {
      if (
        event instanceof CustomEvent &&
        event.detail.namespace === namespace
      ) {
        latest.current = event.detail.preference;
        setPreference(latest.current);
      }
      if (
        event instanceof StorageEvent &&
        (event.key === musicPreferenceKey(namespace) || event.key === null)
      ) {
        latest.current = readMusicPreference(namespace);
        setPreference(latest.current);
      }
    };
    window.addEventListener(MUSIC_PREFERENCE_EVENT, changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener(MUSIC_PREFERENCE_EVENT, changed);
      window.removeEventListener("storage", changed);
    };
  }, [namespace]);
  const update = (patch: Partial<MusicPreferences>) => {
    const next = normalizeMusicPreference({ ...latest.current, ...patch });
    latest.current = next;
    setPreference(next);
    window.dispatchEvent(
      new CustomEvent(MUSIC_PREFERENCE_EVENT, {
        detail: { namespace, preference: next },
      }),
    );
    try {
      localStorage.setItem(musicPreferenceKey(namespace), JSON.stringify(next));
    } catch {
      throw Error(
        "Хөгжмийн тохиргоог энэ төхөөрөмжид хадгалж чадсангүй. Тоглуулах боломжтой хэвээр.",
      );
    }
  };
  return [preference, update] as const;
}
