"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { StudyStore } from "@/lib/persistence/store";
import { buildIndex } from "@/lib/calculations/analytics";
import { dateKey } from "@/lib/calculations/dates";
import type { StudyData, StudyIndex, View } from "@/types/study";
type ContextValue = {
  store: StudyStore;
  data: StudyData;
  index: StudyIndex;
  today: string;
  view: View;
  navigate: (view: View) => void;
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
  const { subjects, sessions, entries } = state.data;
  const index = useMemo(
    () => buildIndex({ subjects, sessions, entries } as StudyData, today),
    [subjects, sessions, entries, today],
  );
  useEffect(() => {
    void store.initialize();
    const refresh = () => {
      setToday(dateKey());
      void store.reload().catch(store.reportError);
    };
    window.addEventListener("focus", refresh);
    const id = setInterval(() => setToday(dateKey()), 30000);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [store]);
  useEffect(() => {
    document.documentElement.dataset.design = state.data.settings.world.design;
    const theme = state.data.settings.theme,
      m = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (m.matches ? "dark" : "light") : theme;
    };
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [state.data.settings.theme, state.data.settings.world.design]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  const run = useCallback(
    async (fn: () => Promise<void>, message?: string) => {
      try {
        await fn();
        if (message) setNotice(message);
        return true;
      } catch (error) {
        store.reportError(error);
        return false;
      }
    },
    [store],
  );
  const navigate = useCallback((v: View) => {
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
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now()),
      id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);
  return now;
}
