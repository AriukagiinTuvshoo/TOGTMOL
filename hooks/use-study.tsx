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
import { studyDate } from "@/lib/calculations/dates";
import { calendarTimeZone } from "@/lib/calculations/calendar";
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
    [today, setToday] = useState(() =>
      studyDate(
        new Date(),
        dayBoundary(store.getSnapshot().data.settings),
        calendarTimeZone(store.getSnapshot().data),
      ),
    ),
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