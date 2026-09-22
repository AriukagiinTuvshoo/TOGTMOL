"use client";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "./use-study";
import {
  MUSIC_PREFERENCE_EVENT,
  musicPreferenceKey,
  normalizeMusicPreference,
  readMusicPreference,
  type MusicPreferences,
} from "@/lib/music/preferences";

export function useMusicPreference(namespace: string) {
  const { data, store } = useStudy();
  const [preference, setPreference] = useState(() =>
    data.settings.extras.musicPreferences
      ? normalizeMusicPreference(data.settings.extras.musicPreferences)
      : readMusicPreference(namespace),
  );
  const latest = useRef(preference);
  useEffect(
    () =>
      store.subscribe(() => {
        const snapshot = store.getSnapshot();
        if (
          snapshot.namespace !== namespace ||
          !snapshot.data.settings.extras.musicPreferences
        )
          return;
        const saved = normalizeMusicPreference(
          snapshot.data.settings.extras.musicPreferences,
        );
        if (JSON.stringify(saved) !== JSON.stringify(latest.current)) {
          latest.current = saved;
          setPreference(saved);
        }
      }),
    [store, namespace],
  );
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
      /* IndexedDB remains available when small browser storage is blocked. */
    }
    void store
      .mutate((d) => {
        if (store.getSnapshot().namespace !== namespace) return d;
        return {
          ...d,
          settings: {
            ...d.settings,
            updatedAt: Date.now(),
            extras: { ...d.settings.extras, musicPreferences: next },
          },
        };
      })
      .catch(store.reportError);
  };
  return [preference, update] as const;
}
