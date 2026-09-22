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
  const [error, setError] = useState("");
  const latest = useRef(preference),
    pending = useRef(0),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(
    () =>
      store.subscribe(() => {
        const snapshot = store.getSnapshot();
        if (
          pending.current ||
          snapshot.busy ||
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
        event.detail?.namespace === namespace
      ) {
        latest.current = normalizeMusicPreference(event.detail.preference);
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
  const update = async (patch: Partial<MusicPreferences>): Promise<boolean> => {
    const next = normalizeMusicPreference({ ...latest.current, ...patch });
    latest.current = next;
    if (active.current) setPreference(next);
    window.dispatchEvent(
      new CustomEvent(MUSIC_PREFERENCE_EVENT, {
        detail: { namespace, preference: next },
      }),
    );
    try {
      // Compatibility with the existing music settings; IndexedDB remains authoritative.
      localStorage.setItem(musicPreferenceKey(namespace), JSON.stringify(next));
    } catch {
      /* Private mode may still allow the existing IndexedDB store. */
    }
    pending.current++;
    try {
      await store.mutate(
        (d) => {
          if (store.getSnapshot().namespace !== namespace) return d;
          const current = normalizeMusicPreference(
            d.settings.extras.musicPreferences ?? next,
          );
          return {
            ...d,
            settings: {
              ...d.settings,
              updatedAt: Date.now(),
              extras: {
                ...d.settings.extras,
                musicPreferences: normalizeMusicPreference({
                  ...current,
                  ...patch,
                }),
              },
            },
          };
        },
        { reportError: false, reportBusy: false },
      );
      if (active.current) setError("");
      return true;
    } catch {
      if (active.current)
        setError(
          "Хөгжмийн тохиргоог хадгалж чадсангүй. Сонголтоо дахин хадгалж үзнэ үү.",
        );
      return false;
    } finally {
      pending.current--;
    }
  };
  return [preference, update, error] as const;
}
