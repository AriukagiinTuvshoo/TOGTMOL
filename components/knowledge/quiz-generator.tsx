"use client";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { Modal, SubjectSelect } from "@/components/ui/common";
import { getSupabase } from "@/lib/supabase/client";
import {
  localQuizDrafts,
  parseQuizDrafts,
  type QuizDraft,
} from "@/lib/knowledge/generation";
import { recordBase, saveKnowledge } from "@/lib/knowledge/actions";
import { uid } from "@/lib/constants";
import type { QuizQuestion, StudyQuiz } from "@/types/knowledge";

export function QuizGenerator({ onClose }: { onClose: () => void }) {
  const { data, store, run } = useStudy();
  const [title, setTitle] = useState("Бондоок · Миний сорил"),
    [subject, setSubject] = useState(""),
    [source, setSource] = useState(""),
    [text, setText] = useState(""),
    [online, setOnline] = useState(false),
    [count, setCount] = useState(5),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drafts, setDrafts] = useState<QuizDraft[] | null>(null);
  const disposed = useRef(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      pending.current?.abort();
    };
  }, []);

  const notes = data.knowledge.filter(
    (r) =>
      r.kind === "note" &&
      !r.deletedAt &&
      (!subject || r.subjectId === subject),
  );

  const generate = async () => {
    const namespace = store.getSnapshot().namespace;
    setBusy(true);
    setError("");
    try {
      if (!online) {
        setDrafts(localQuizDrafts(text, count));
        return;
      }
      const client = getSupabase();
      const session = client
        ? (await client.auth.getSession()).data.session
        : null;
      if (!session || namespace !== `account:${session.user.id}`)
        throw Error(
          "Онлайн Бондоокийг ашиглахын тулд бүртгэлээрээ нэвтэрнэ үү.",
        );

      const controller = new AbortController();
      pending.current = controller;
      const timer = window.setTimeout(() => controller.abort(), 35000);
      try {
        const response = await fetch("/api/bondook/quiz", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text, count }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "Quiz бэлдэж чадсангүй.");
        const parsed = parseQuizDrafts(result);
        if (!disposed.current) setDrafts(parsed);
      } finally {
        window.clearTimeout(timer);
      }
    } catch (e) {
      if (!disposed.current)
        setError(e instanceof Error ? e.message : "Холбогдсонгүй.");
    } finally {
      if (!disposed.current) setBusy(false);
    }
  };

  const save = async () => {
    if (!drafts?.length) return;
    setBusy(true);
    const ok = await run(async () => {
      const questions: QuizQuestion[] = parseQuizDrafts({
        questions: drafts,
      }).map((q) => ({
        id: uid("question"),
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
      }));
      const quiz: StudyQuiz = {
        ...recordBase(title, subject || null),
        kind: "quiz",
        questions,
      };
      await store.mutate(saveKnowledge(quiz));
    }, "Бондоокийн сорилыг хадгаллаа.");
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Бондоок · тэмдэглэлээс Quiz руу" onClose={onClose}>
      <div className="form-stack">
        {!drafts ? (
          <>
            <label>
              Сэдэв
              <SubjectSelect value={subject} onChange={setSubject} />
            </label>
            <label>
              Эх материал
              <select
                value={source}
                onChange={(e) => {
                  const id = e.target.value;
                  setSource(id);
                  if (id === "subject") {
                    setText(
                      notes
                        .map((r) =>
                          r.kind === "note" ? `${r.title}\\n${r.body}` : "",
                        )
                        .join("\\n\\n")
                        .slice(0, 12000),
                    );
                    return;
                  }
                  const note = notes.find((r) => r.id === id);
                  if (note?.kind === "note") {
                    setText(note.body.slice(0, 12000));
                    setTitle(note.title + " · Quiz");
                  }
                }}
              >
                <option value="">Текстээ оруулах</option>
                {subject && (
                  <option value="subject">Энэ хичээлийн тэмдэглэлүүд</option>
                )}
                {notes.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Суралцах материал
              <textarea
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={12000}
                placeholder="Жишээ: Python функц нь дахин ашиглах кодын хэсэг..."
              />
            </label>
            <label>
              Асуултын тоо
              <input
                type="number"
                min={2}
                max={12}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={online}
                onChange={(e) => setOnline(e.target.checked)}
              />
              Онлайн Бондоок ашиглах
            </label>
            <p className="tiny muted">
              Онлайн горимд зөвхөн дээрх материал AI руу илгээгдэнэ. Эхлээд
              асуулт бүрийг хянаад, дараа нь хадгална.
            </p>
            <button
              className="button primary"
              disabled={busy || !text.trim() || count < 2 || count > 12}
              onClick={() => void generate()}
            >
              {busy
                ? "Бэлдэж байна…"
                : online
                  ? "AI Quiz бэлдэх"
                  : "Local Quiz бэлдэх"}
            </button>
          </>
        ) : (
          <>
            <p className="tiny muted">
              Хадгалахаас өмнө бүх асуулт, сонголт, зөв хариултыг хяне��4����k�w��`} = state.data;
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
    async (fn: () => Promise<void>, message?: string, undoable = false) => {
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
          if (removed.length && undoable)
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
