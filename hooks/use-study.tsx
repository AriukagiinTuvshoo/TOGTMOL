"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { StudyStore } from "@/lib/persistence/store";
import { buildIndex } from "@/lib/calculations/analytics";
import { ACHIEVEMENTS } from "@/lib/calculations/achievements";
import { dayBoundary } from "@/lib/preferences";
import { enableSound } from "@/lib/notifications";
import { ROOM_THEMES } from "@/lib/world/room-themes";
import { dateKey, studyDate } from "@/lib/calculations/dates";
import type { StudyData, StudyIndex, View } from "@/types/study";
type ContextValue = {
  store: StudyStore;
  data: StudyData;
  index: StudyIndex;
  today: string;
  view: View;
  navigate: (view: View, recordId?: string) => void;
  selectedRecord: string | null;
  undo: (() => Promise<void>) | null;
  run: (fn: () => Promise<void>, message?: string) => Promise<boolean>;
  notice: string;
  setNotice: (text: string) => void;
};
const Context = createContext<ContextValue | null>(null);
export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => new StudyStore()),
    state = useSyncExternalStore(
      store.subscribe,
      store.getSnapshot,
      store.getServerSnapshot,
    );
  const [view, setView] = useState<View>("overview"),
    [today, setToday] = useState(dateKey),
    [notice, setNotice] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [undo, setUndo] = useState<(() => Promise<void>) | null>(null);
  const { subjects, sessions, entries, settings } = state.data;
  const boundary = dayBoundary(settings);
  const index = useMemo(
    () =>
      buildIndex({ subjects, sessions, entries } as StudyData, today, boundary),
    [subjects, sessions, entries, boundary, today],
  );
  useEffect(() => {
    void store.initialize();
    const refresh = () => {
      setToday(
        studyDate(new Date(), dayBoundary(store.getSnapshot().data.settings)),
      );
      void store.reload().catch(store.reportError);
    };
    window.addEventListener("focus", refresh);
    const id = setInterval(
      () =>
        setToday(
          studyDate(new Date(), dayBoundary(store.getSnapshot().data.settings)),
        ),
      30000,
    );
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [store]);
  useEffect(() => {
    const tick = setTimeout(() => setToday(studyDate(new Date(), boundary)), 0);
    return () => clearTimeout(tick);
  }, [boundary]);
  useEffect(() => {
    if (!settings.sound) return;
    const prime = () => {
      void enableSound().catch(() => {});
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, [settings.sound]);
  useEffect(() => {
    const design = state.data.settings.world.design,
      roomTheme = ROOM_THEMES[design],
      root = document.documentElement,
      theme = state.data.settings.theme,
      uiThemeRaw = state.data.settings.extras.uiTheme,
      uiTheme =
        uiThemeRaw === "cyber" || uiThemeRaw === "calm" ? uiThemeRaw : "aurora",
      m = window.matchMedia("(prefers-color-scheme: dark)");
    root.dataset.design = design;
    root.dataset.uiTheme = uiTheme;
    const apply = () => {
      const mode = theme === "system" ? (m.matches ? "dark" : "light") : theme;
      const tokens = roomTheme.ui[mode];
      root.dataset.theme = mode;
      root.style.colorScheme = mode;
      root.style.setProperty("--bg", tokens.bg);
      root.style.setProperty("--surface", tokens.surface);
      root.style.setProperty("--surface-muted", tokens.surfaceMuted);
      root.style.setProperty("--text", tokens.text);
      root.style.setProperty("--muted", tokens.muted);
      root.style.setProperty("--border", tokens.border);
      root.style.setProperty("--moss", tokens.accent);
      root.style.setProperty("--moss-soft", tokens.accentSoft);
      root.style.setProperty("--hero", tokens.hero);
      root.style.setProperty(
        "--yellow",
        "yellow" in tokens ? tokens.yellow : "#e8c890",
      );
      root.style.setProperty("--yellow-soft", tokens.yellowSoft);
      root.style.setProperty(
        "--world-radius",
        "radius" in tokens && tokens.radius
          ? tokens.radius
          : roomTheme.ui.light.radius,
      );
      root.style.setProperty(
        "--world-button",
        "buttonRadius" in tokens && tokens.buttonRadius
          ? tokens.buttonRadius
          : roomTheme.ui.light.buttonRadius,
      );
      root.style.setProperty(
        "--world-shadow",
        "shadow" in tokens && tokens.shadow
          ? tokens.shadow
          : roomTheme.ui.light.shadow,
      );
      root.style.setProperty("--world-display-font", roomTheme.fontFamily);
      root.style.setProperty(
        "--room-body-background-image",
        roomTheme.bodyBackgroundImage ?? "none",
      );
      root.style.setProperty(
        "--room-body-background-size",
        roomTheme.bodyBackgroundSize ?? "auto",
      );
      root.style.setProperty(
        "--danger",
        "danger" in tokens && tokens.danger ? tokens.danger : "#eca6a0",
      );
    };
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [
    state.data.settings.theme,
    state.data.settings.world.design,
    state.data.settings.extras.uiTheme,
  ]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(
      () => {
        setNotice("");
        setUndo(null);
      },
      undo ? 15000 : 12000,
    );
    return () => clearTimeout(id);
  }, [notice, undo]);
  const run = useCallback(
    async (fn: () => Promise<void>, message?: string) => {
      const previous = store.getSnapshot();
      try {
        await fn();
        const current = store.getSnapshot();
        if (current.namespace === previous.namespace) {
          const removed = (
            [
              "subjects",
              "sessions",
              "tasks",
              "knowledge",
              "studyGoals",
              "musicSources",
            ] as const
          ).flatMap((collection) => {
            const before = new Map(
              previous.data[collection].map((r) => [r.id, r.deletedAt]),
            );
            return current.data[collection]
              .filter(
                (r) => r.deletedAt && before.has(r.id) && !before.get(r.id),
              )
              .map((r) => ({ collection, id: r.id, deletedAt: r.deletedAt }));
          });
          if (removed.length)
            setUndo(() => async () => {
              if (store.getSnapshot().namespace !== current.namespace)
                throw Error("Хадгалалтын горим өөрчлөгдсөн байна.");
              await store.mutate((d) => {
                let next = d;
                for (const { collection, id, deletedAt } of removed)
                  next = {
                    ...next,
                    [collection]: next[collection].map((r) =>
                      r.id === id && r.deletedAt === deletedAt
                        ? {
                            ...r,
                            deletedAt: null,
                            updatedAt: Math.max(Date.now(), r.updatedAt + 1),
                          }
                        : r,
                    ),
                  };
                return next;
              });
              setUndo(null);
              setNotice("Сэргээсэн.");
            });
          const newAwards = ACHIEVEMENTS.filter(
            (a) =>
              current.data.achievementsUnlocked[a.id] &&
              !previous.data.achievementsUnlocked[a.id],
          );
          if (message || newAwards.length)
            setNotice(
              [
                message,
                newAwards.length
                  ? `Амжилт: ${newAwards.map((a) => a.name).join(" · ")}`
                  : "",
              ]
                .filter(Boolean)
                .join(" "),
            );
        }
        return true;
      } catch (error) {
        store.reportError(error);
        return false;
      }
    },
    [store],
  );
  const navigate = useCallback((v: View, recordId?: string) => {
    setSelectedRecord(recordId ?? null);
    setView(v);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  return (
    <Context.Provider
      value={{
        store,
        data: state.data,
        index,
        today,
        view,
        navigate,
        selectedRecord,
        undo,
        run,
        notice,
        setNotice,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStudy() {
  const value = useContext(Context);
  if (!value) throw Error("StudyProvider шаардлагатай.");
  return value;
}
export function useStoreState() {
  const { store } = useStudy();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}
export function useClock(active = true) {
  const [now, setNow] = useState(() => Date.now());
  const second = useRef(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      // A fired RAF handle must not stay truthy after the callback returns.
      // Otherwise a hidden tab can resume with no new animation frame scheduled.
      frame = 0;
      const value = Date.now();
      const nextSecond = Math.floor(value / 1000);
      if (nextSecond !== second.current) {
        second.current = nextSecond;
        setNow(value);
      }
      if (document.visibilityState === "visible")
        frame = window.requestAnimationFrame(tick);
    };
    const refresh = () => {
      const value = Date.now();
      second.current = Math.floor(value / 1000);
      setNow(value);
      if (document.visibilityState === "visible" && !frame)
        frame = window.requestAnimationFrame(tick);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [active]);
  return now;
}
