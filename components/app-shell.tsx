"use client";

import dynamic from "next/dynamic";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  House,
  Volume2,
  Timer as TimerIcon,
  Brain,
  Target,
  ChartColumn,
  Flame,
  Clock3,
  ShieldCheck,
  DoorOpen,
  X,
  Play,
  Calendar,
  BookOpen,
  Sparkles,
  Award,
  Settings as SettingsIcon,
  PartyPopper,
  Menu,
  Mic,
  User as UserIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  StudyProvider,
  useStudy,
  useStoreState,
  useClock,
} from "@/hooks/use-study";
import { AccountProvider, useAccount } from "@/hooks/use-account";
import type { View } from "@/types/study";
import { Icon } from "./ui/icon";
import { AppSkeleton } from "./ui/app-skeleton";
import { actions } from "@/lib/persistence/actions";
import { elapsed } from "@/lib/calculations/timer";
import { currentStreak } from "@/lib/calculations/dates";
import { enableSound } from "@/lib/notifications";
import { knowledgeIndex } from "@/lib/knowledge/index";
import { ModuleBoundary } from "./ui/module-boundary";
import { RecoveryPanel } from "./settings/recovery";
import { GlobalSearch } from "./knowledge/search";
import { StudyRoom } from "./world/study-room";
import { MusicPlayer, MusicProvider } from "./music/music-player";
import { LanguageProvider, useI18n } from "./i18n/language-provider";
import { LanguageSwitcher } from "./i18n/language-switcher";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { StudyTimer, TimerWatch } from "./timer/study-timer";
import { StudyCalendar } from "./calendar/study-calendar";
import { Subjects } from "./subjects/subjects";
import { Goals } from "./goals/goals";
import { Achievements } from "./achievements/achievements";
import { Settings } from "./settings/settings";
import { PwaManager } from "./settings/pwa";
import { RoomBackground } from "./v9/room-background";
import { BondookAvatar } from "./v9/bondook-widget";
import { SoundStudioView, useSoundEngine } from "./v9/audio-mixer";
import { VoiceFlowBar } from "./v9/voice-flowbar";
import { AuthModal, type AuthModalTab } from "./v9/auth-modal";
import { QuickToolsModal } from "./v9/quick-tools";
import { EmojiBurstLayer } from "./v9/emoji-burst";
import {
  getActiveSimpleProfileSnapshot,
  namespaceForProfile,
  subscribeSimpleProfile,
} from "@/lib/v9/simple-profile";
import { ROOMS, resolveV9RoomId, roomById } from "@/lib/v9/rooms";
import { PRESETS, engine } from "@/lib/v9/audio-engine";
import { BONDOOK_TIPS, fmtClock, fmtMnDuration } from "@/lib/v9/focus";

function LocalizedLoading() {
  const { t } = useI18n();
  return <p role="status">{t("common.loading")}</p>;
}
const KnowledgeHub = dynamic(
  () => import("./knowledge/hub").then((m) => m.KnowledgeHub),
  { loading: () => <LocalizedLoading /> },
);
const PrivacyCenter = dynamic(
  () => import("./settings/privacy").then((m) => m.PrivacyCenter),
  { loading: () => <LocalizedLoading /> },
);
const CustomizeRoom = dynamic(() =>
  import("./world/customize").then((m) => m.CustomizeRoom),
);
const Statistics = dynamic(() =>
  import("./statistics/statistics").then((m) => m.Statistics),
);
const Assistant = dynamic(() =>
  import("./assistant/chat").then((m) => m.BondookChat),
);

type NavItem = { view: View; label: TranslationKey; icon: string };

const NAV_GROUPS: {
  label: TranslationKey;
  icon: string;
  home: View;
  items: NavItem[];
}[] = [
  {
    label: "nav.groupToday",
    icon: "home",
    home: "overview",
    items: [{ view: "overview", label: "nav.overview", icon: "home" }],
  },
  {
    label: "nav.groupLearn",
    icon: "book",
    home: "knowledge",
    items: [
      { view: "knowledge", label: "nav.knowledge", icon: "book" },
      { view: "calendar", label: "nav.calendar", icon: "calendar" },
      { view: "subjects", label: "nav.subjects", icon: "book" },
    ],
  },
  {
    label: "nav.groupProgress",
    icon: "chart",
    home: "statistics",
    items: [
      { view: "statistics", label: "nav.statistics", icon: "chart" },
      { view: "goals", label: "nav.goals", icon: "target" },
      { view: "achievements", label: "nav.achievements", icon: "award" },
    ],
  },
  {
    label: "nav.groupCompanion",
    icon: "spark",
    home: "assistant",
    items: [{ view: "assistant", label: "nav.assistant", icon: "spark" }],
  },
  {
    label: "nav.groupSettings",
    icon: "settings",
    home: "settings",
    items: [
      { view: "settings", label: "nav.settings", icon: "settings" },
      { view: "room", label: "nav.room", icon: "sun" },
      { view: "privacy", label: "nav.privacy", icon: "shield" },
    ],
  },
];

const titles: Record<View, TranslationKey> = {
  overview: "page.overview",
  timer: "page.timer",
  calendar: "page.calendar",
  subjects: "page.subjects",
  statistics: "page.statistics",
  goals: "page.goals",
  achievements: "page.achievements",
  assistant: "page.assistant",
  settings: "page.settings",
  room: "page.room",
  focus: "page.focus",
  knowledge: "page.knowledge",
  privacy: "page.privacy",
};

interface V9Toast {
  id: number;
  title: string;
  desc?: string;
  emoji?: string;
}

let nextToastId = 1;

function LiveClock({ ready }: { ready: boolean }) {
  const nowEpoch = useClock(ready);
  if (!ready) return null;

  const nowDate = new Date(nowEpoch);
  const hh = String(nowDate.getHours()).padStart(2, "0");
  const mm = String(nowDate.getMinutes()).padStart(2, "0");
  const ss = String(nowDate.getSeconds()).padStart(2, "0");
  const day = nowDate.toLocaleDateString("mn-MN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <span
      className="hidden items-baseline gap-1 rounded-full bg-white/[.07] px-2.5 py-1 ring-1 ring-white/10 xl:inline-flex"
      title={`${day} · Жинхэнэ цаг`}
    >
      <span className="font-display text-[12px] font-bold leading-none tabular-nums text-white">
        {hh}:{mm}
      </span>
      <span className="text-[10px] font-bold tabular-nums text-white/45">
        :{ss}
      </span>
      <span className="ml-1 text-[10px] text-white/45">{day}</span>
    </span>
  );
}

function Shell() {
  const {
      view,
      navigate,
      today,
      store,
      notice,
      setNotice,
      run,
      undo,
      selectedRecord,
      data,
      index,
    } = useStudy(),
    state = useStoreState(),
    { status, user } = useAccount(),
    { t, language } = useI18n(),
    soundState = useSoundEngine(),
    timerNow = useClock(Boolean(data.activeTimer?.running));

  const [more, setMore] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [soundTabRequested, setSoundTabRequested] = useState(false);
  const soundSubView = view === "overview" && soundTabRequested;
  const [showRooms, setShowRooms] = useState(false);
  const [shield, setShield] = useState(false);
  const [voiceBarOpen, setVoiceBarOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab | null>(null);
  const [quickToolsOpen, setQuickToolsOpen] = useState(false);
  const [toasts, setToasts] = useState<V9Toast[]>([]);
  const [tipIdx, setTipIdx] = useState(0);
  const simpleProfile = useSyncExternalStore(
    subscribeSimpleProfile,
    getActiveSimpleProfileSnapshot,
    () => null,
  );
  const prevTimerPhaseRef = useRef<string | null>(null);

  // Automatically restore saved Simple Profile namespace after initial guest boot
  useEffect(() => {
    if (!state.ready || !simpleProfile || user) return;
    const expectedNs = namespaceForProfile(simpleProfile.id);
    if (state.namespace === "guest") {
      void store.switchNamespace(expectedNs, true).catch(() => {});
    }
  }, [simpleProfile, state.namespace, state.ready, store, user]);

  const activeRoomId = resolveV9RoomId(data.settings.world);
  const room = roomById(activeRoomId);
  const accent = room.accent;

  // Global keyboard shortcuts: Alt+V (Voice FlowBar) & Alt+K (Quick Tools)
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.altKey && ev.code === "KeyV") {
        ev.preventDefault();
        setVoiceBarOpen((v) => !v);
      } else if (ev.altKey && ev.code === "KeyK") {
        ev.preventDefault();
        setQuickToolsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Timer-linked Smart Audio Automation (Auto-Duck on Break & Auto-Start Focus Sound)
  useEffect(() => {
    const currentPhase = data.activeTimer?.running
      ? data.activeTimer.phase
      : null;
    const autoDuck = Boolean(data.settings.extras.autoDuckOnBreak);
    const autoStart = Boolean(data.settings.extras.autoStartFocusSound);

    if (autoDuck) {
      const isBreak =
        currentPhase === "shortBreak" || currentPhase === "longBreak";
      engine.setDuckFactor(isBreak ? 0.45 : 1);
    } else {
      engine.setDuckFactor(1);
    }

    if (
      autoStart &&
      currentPhase === "focus" &&
      prevTimerPhaseRef.current !== "focus" &&
      engine.getSnapshot().activeCount === 0
    ) {
      engine.applyPreset(room.preset || "rainy_cafe");
    }
    prevTimerPhaseRef.current = currentPhase;
  }, [
    data.activeTimer?.phase,
    data.activeTimer?.running,
    data.settings.extras.autoDuckOnBreak,
    data.settings.extras.autoStartFocusSound,
    room.preset,
  ]);

  const todaySeconds = index.days.get(today)?.seconds ?? 0;
  const streak = useMemo(
    () => currentStreak(new Set(index.sortedDates), today),
    [index.sortedDates, today],
  );
  const dueCards = useMemo(
    () =>
      state.ready
        ? knowledgeIndex(data.knowledge, today, data.settings).reviewQueue
            .length
        : 0,
    [data.knowledge, data.settings, state.ready, today],
  );
  const openTasksCount = useMemo(
    () => data.tasks.filter((tk) => !tk.deletedAt && !tk.completed).length,
    [data.tasks],
  );

  const liveTimerClock = useMemo(() => {
    const active = data.activeTimer;
    if (!active) return "00:00";
    const ms = elapsed(active, timerNow);
    const sec =
      active.targetMs !== null
        ? Math.ceil(Math.max(0, active.targetMs - ms) / 1000)
        : Math.floor(ms / 1000);
    return fmtClock(sec);
  }, [data.activeTimer, timerNow]);

  const pushToast = useCallback((item: Omit<V9Toast, "id">) => {
    const id = nextToastId++;
    setToasts((prev) => [...prev.slice(-3), { ...item, id }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      4200,
    );
  }, []);

  const celebrate = useCallback(
    (
      _xp: number,
      title: string,
      desc = "Үргэлжлүүл — тогтмол байдал ялна ✨",
    ) => {
      pushToast({ title, desc, emoji: "⚡" });
    },
    [pushToast],
  );

  const go = (v: View) => {
    setSoundTabRequested(false);
    setMore(false);
    setDrawerOpen(false);
    navigate(v);
  };

  useEffect(() => {
    const id = setInterval(
      () => setTipIdx((i) => (i + 1) % BONDOOK_TIPS.length),
      15000,
    );
    return () => clearInterval(id);
  }, []);

  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some((item) => item.view === view),
  );
  const moreButton = useRef<HTMLButtonElement>(null),
    morePanel = useRef<HTMLDivElement>(null);
  const closeMore = () => {
    setMore(false);
    moreButton.current?.focus();
  };

  useEffect(() => {
    if (!more) return;
    morePanel.current
      ?.querySelector<HTMLElement>(".mobile-more nav button")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMore(false);
        moreButton.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !morePanel.current) return;
      const focusable = [
        ...morePanel.current.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [more]);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    document.title = `${t(titles[view])} · ${language === "en" ? "TOGTMOL" : "Тогтмол"}`;
  }, [language, t, view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowRooms(false);
        setShield(false);
        setDrawerOpen(false);
      }
      if (event.key !== " " || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true']",
        )
      )
        return;
      if (document.querySelector("dialog[open]")) return;
      const snapshot = store.getSnapshot();
      if (!snapshot.ready || snapshot.busy) return;
      event.preventDefault();
      void (async () => {
        const current = store.getSnapshot().data.activeTimer;
        if (!current) {
          const subject = store
            .getSnapshot()
            .data.subjects.find((item) => !item.deletedAt && !item.archived);
          if (!subject) {
            navigate("subjects");
            setNotice(t("shell.todayNotice"));
            return;
          }
          try {
            await enableSound();
          } catch {
            // Keyboard start must not be blocked by browser audio policy.
          }
          if (
            await run(() =>
              store.mutate(
                actions.start(
                  subject.id,
                  data.settings.defaultTimer,
                  "focus",
                  data.settings.defaultTimer === "pomodoro"
                    ? data.settings.focusMinutes
                    : null,
                ),
              ),
            )
          )
            navigate("focus");
          return;
        }
        if (current.status === "review") {
          navigate("timer");
          return;
        }
        const deadlineReached =
          current.running &&
          current.targetMs !== null &&
          elapsed(current, Date.now()) >= current.targetMs;
        await run(() =>
          store.mutate(
            deadlineReached
              ? actions.finish()
              : current.running
                ? actions.pause()
                : actions.resume(),
          ),
        );
      })();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [data.settings, navigate, run, setNotice, store, t]);

  const PRIMARY_TABS: {
    id: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    badge?: number;
    onClick: () => void;
  }[] = [
    {
      id: "room-home",
      label: "Миний өрөө",
      icon: House,
      active: view === "overview" && !soundSubView,
      onClick: () => {
        setSoundTabRequested(false);
        navigate("overview");
      },
    },
    {
      id: "sound",
      label: "Дуу",
      icon: Volume2,
      active: view === "overview" && soundSubView,
      badge: soundState.activeCount || undefined,
      onClick: () => {
        setSoundTabRequested(true);
        navigate("overview");
      },
    },
    {
      id: "timer",
      label: "Цаг",
      icon: TimerIcon,
      active: view === "timer",
      onClick: () => go("timer"),
    },
    {
      id: "knowledge",
      label: "Мэдлэг",
      icon: Brain,
      active: view === "knowledge",
      badge: dueCards || undefined,
      onClick: () => go("knowledge"),
    },
    {
      id: "goals",
      label: "Зорилго",
      icon: Target,
      active: view === "goals",
      badge: openTasksCount || undefined,
      onClick: () => go("goals"),
    },
    {
      id: "statistics",
      label: "Статистик",
      icon: ChartColumn,
      active: view === "statistics",
      onClick: () => go("statistics"),
    },
  ];

  const SECONDARY_TABS: {
    view: View;
    label: string;
    icon: LucideIcon;
  }[] = [
    { view: "calendar", label: "Календарь", icon: Calendar },
    { view: "subjects", label: "Хичээлүүд", icon: BookOpen },
    { view: "assistant", label: "Бондоок", icon: Sparkles },
    { view: "achievements", label: "Амжилт", icon: Award },
    { view: "settings", label: "Тохиргоо", icon: SettingsIcon },
  ];

  const tip = BONDOOK_TIPS[tipIdx];

  return (
    <div
      className={`app-shell v9-shell ${view === "focus" ? "is-focus" : ""}`}
      style={{ ["--v9-accent" as string]: accent }}
    >
      <RoomBackground
        room={room}
        autoDayNight={data.settings.extras.autoDayNight !== false}
      />

      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        {t("shell.skip")}
      </a>

      {/* ── FOCUS SHIELD OVERLAY ── */}
      {shield && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur-xl">
          <div className="anim-pop flex max-w-md flex-col items-center text-center">
            <ShieldCheck size={44} style={{ color: accent }} />
            <h2 className="mt-3 font-display text-2xl font-bold text-white">
              Фокус бамбай 🛡️
            </h2>
            <p className="mt-1 text-[13px] text-white/60">
              Дэлхий түр хүлээнэ. Зөвхөн чи, амьсгал, зорилго.
            </p>
            <div className="mt-5">
              <BondookAvatar
                mood={data.activeTimer?.running ? "focus" : "sleep"}
                size={120}
              />
            </div>
            <div className="mt-4 grid w-full grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/12">
                <Clock3 size={16} className="mx-auto text-white/60" />
                <div className="mt-1 font-display text-[15px] font-bold text-white">
                  {fmtMnDuration(todaySeconds)}
                </div>
                <div className="text-[10px] text-white/50">өнөөдөр</div>
              </div>
              <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/12">
                <Flame size={16} className="mx-auto text-orange-400" />
                <div className="mt-1 font-display text-[15px] font-bold text-white">
                  {streak} өдөр
                </div>
                <div className="text-[10px] text-white/50">цуврал</div>
              </div>
              <div className="rounded-2xl bg-white/8 p-3 ring-1 ring-white/12">
                <Volume2 size={16} className="mx-auto text-white/60" />
                <div className="mt-1 font-display text-[15px] font-bold text-white">
                  {soundState.activeCount}
                </div>
                <div className="text-[10px] text-white/50">суваг</div>
              </div>
            </div>
            <p className="mt-4 rounded-2xl bg-white/6 px-4 py-2.5 text-[13px] italic text-white/75 ring-1 ring-white/10">
              “{tip.title} — {tip.body}”
            </p>
            <button
              type="button"
              onClick={() => setShield(false)}
              className="mt-5 flex items-center gap-2 rounded-2xl px-8 py-3 font-display text-[14px] font-bold text-white transition hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}77)`,
              }}
            >
              <DoorOpen size={16} /> Бамбай буулгах
            </button>
          </div>
        </div>
      )}

      {/* ── ACCESSIBLE SLIDE-OUT STUDY SPACE DRAWER (Preserves full grouped navigation & test contracts) ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[65] bg-black/55 backdrop-blur-xs"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar v9-drawer ${drawerOpen ? "is-open" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <button className="brand" onClick={() => go("overview")}>
            <span className="brand-mark">
              <Icon name="leaf" size={22} />
            </span>
            <span>
              тогтмол<span className="brand-version">STUDY OS · v9</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-xl bg-white/8 text-white/70 hover:bg-white/15"
            aria-label="Цэс хаах"
          >
            <X size={15} />
          </button>
        </div>
        <div className="nav-caption">{t("shell.mySpace")}</div>
        <nav aria-label={t("shell.mySpace")}>
          {NAV_GROUPS.map((group) => {
            const active = group.items.some((item) => item.view === view),
              single = group.items.length === 1,
              label = single ? group.items[0].label : group.label;
            return (
              <button
                key={group.label}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                aria-expanded={single ? undefined : active}
                aria-controls={single ? undefined : "nav-sub-panel"}
                onClick={() => go(group.home)}
              >
                <Icon name={group.icon} />
                {t(label)}
                {group.home === "assistant" && (
                  <span className="nav-tag" aria-hidden="true">
                    LOCAL
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        {activeGroup && activeGroup.items.length > 1 && (
          <div
            className="nav-sub"
            id="nav-sub-panel"
            role="group"
            aria-label={t(activeGroup.label)}
          >
            {activeGroup.items.map((n) => (
              <button
                key={n.view}
                aria-current={view === n.view ? "page" : undefined}
                onClick={() => go(n.view)}
              >
                <Icon name={n.icon} />
                {t(n.label)}
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Icon name="leaf" size={21} />
            <p>
              {t("shell.quote1")}
              <br />
              {t("shell.quote2")}
            </p>
          </div>
          <button className="profile-button" onClick={() => go("settings")}>
            <span className="avatar">
              <Icon name={user ? "user" : "leaf"} size={18} />
            </span>
            <span>
              <strong>
                {state.namespace === "guest"
                  ? t("shell.device")
                  : (user?.email?.split("@")[0] ?? t("shell.myAccount"))}
              </strong>
              <small>
                {state.namespace === "guest"
                  ? t("common.local")
                  : t("shell.account")}
              </small>
            </span>
            <Icon name="settings" size={16} />
          </button>
        </div>
      </aside>

      <div className="app-main v9-main">
        {/* ── STICKY 2-ROW GLASS HEADER (Exact Match to image-1.png) ── */}
        <header className="v9-header sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 md:px-6">
            {/* Brand */}
            <button
              type="button"
              onClick={() => {
                setSoundTabRequested(false);
                navigate("overview");
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl font-display text-[15px] font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}66)`,
                  boxShadow: `0 4px 18px ${accent}55`,
                }}
              >
                Т
              </span>
              <span className="leading-tight">
                <span className="block font-display text-[14.5px] font-bold tracking-wide text-white">
                  ТОГТМОЛ{" "}
                  <span
                    className="text-[10.5px] font-bold"
                    style={{ color: accent }}
                  >
                    v9
                  </span>
                </span>
                <span className="hidden text-[10px] text-white/50 sm:block">
                  Гүн төвлөрлийн өрөө
                </span>
              </span>
            </button>

            {/* Streak + Today Time + Active Focus + Live Clock */}
            <div className="ml-1.5 hidden items-center gap-1.5 md:flex">
              <span className="flex items-center gap-1 rounded-full bg-orange-400/15 px-2.5 py-1 text-[11px] font-bold text-orange-300 ring-1 ring-orange-400/25">
                <Flame size={12} /> {streak}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-bold text-sky-300 ring-1 ring-sky-400/25">
                <Clock3 size={12} /> {fmtMnDuration(todaySeconds)}
              </span>
              {data.activeTimer?.running && (
                <button
                  type="button"
                  onClick={() => go("focus")}
                  className="flex items-center gap-1.5 rounded-full bg-red-400/15 px-2.5 py-1 text-[11px] font-bold text-red-300 ring-1 ring-red-400/30 transition hover:bg-red-400/25"
                  title="Төвлөрөх цонх нээх"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                  </span>
                  ФОКУС
                  <span className="font-display text-[12.5px] tabular-nums text-white">
                    {liveTimerClock}
                  </span>
                  {data.activeTimer.phase !== "focus" && (
                    <span className="text-emerald-300">☕</span>
                  )}
                </button>
              )}
              <LiveClock ready={state.ready} />
            </div>

            {/* Right Controls */}
            <div className="ml-auto flex items-center gap-1.5">
              {state.ready && (
                <ModuleBoundary name={t("search.module")}>
                  <GlobalSearch />
                </ModuleBoundary>
              )}

              <button
                type="button"
                onClick={() => setVoiceBarOpen((v) => !v)}
                className={`grid h-9 w-9 place-items-center rounded-xl ring-1 transition ${
                  voiceBarOpen
                    ? "bg-amber-400 text-slate-950 ring-amber-300"
                    : "bg-white/8 text-white/80 ring-white/10 hover:bg-white/15"
                }`}
                title="Дуу хоолойн удирдлага (Alt+V)"
                aria-label="Дуу хоолойн удирдлага"
                aria-pressed={voiceBarOpen}
              >
                <Mic size={16} />
              </button>

              <button
                type="button"
                onClick={() => setQuickToolsOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/80 ring-1 ring-white/10 transition hover:bg-white/15"
                title="Оюутны түргэн хэрэгсэл ба хүртээмж (Alt+K)"
                aria-label="Оюутны түргэн хэрэгсэл"
              >
                <Zap size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShield(true)}
                className="hidden h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/75 ring-1 ring-white/10 transition hover:bg-white/15 sm:grid"
                title="Фокус бамбай"
                aria-label="Фокус бамбай"
              >
                <ShieldCheck size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowRooms(true)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-bold text-white ring-1 transition hover:scale-[1.02]"
                style={{
                  background: `${accent}2c`,
                  borderColor: `${accent}55`,
                }}
              >
                <span className="text-sm">{room.emoji}</span>
                <span className="hidden md:inline">{room.nameMn}</span>
              </button>

              <button
                type="button"
                onClick={() => setAuthModalTab("account")}
                className="flex items-center gap-1.5 rounded-xl bg-white/8 px-2.5 py-2 text-[11.5px] font-bold text-white/90 ring-1 ring-white/12 transition hover:bg-white/15"
                title="Профайл, Бүртгэл ба Google AI тохиргоо"
                aria-label="Нэвтрэх ба бүртгэл"
              >
                {simpleProfile ? (
                  <span className="text-sm leading-none">
                    {simpleProfile.avatar}
                  </span>
                ) : (
                  <UserIcon size={14} />
                )}
                <span className="hidden sm:inline">
                  {simpleProfile
                    ? simpleProfile.name
                    : user
                      ? user.email?.split("@")[0]
                      : "Нэвтрэх"}
                </span>
              </button>

              <div className="hidden items-center gap-1.5 xl:flex">
                <LanguageSwitcher compact />
              </div>

              <span
                className={`save-status sr-only ${!online ? "is-offline" : state.busy ? "is-busy" : ""}`}
                role="status"
                aria-live="polite"
                title={!online ? t("shell.offlineHint") : undefined}
              >
                <span className="status-dot" />
                {!online
                  ? t("shell.offline")
                  : state.busy
                    ? t("shell.saveBusy")
                    : state.namespace === "guest"
                      ? t("shell.localStorage")
                      : status}
              </span>

              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-white/75 ring-1 ring-white/10 transition hover:bg-white/15"
                aria-label={t("shell.settings")}
                title="Бүх цэс ба тохиргоо"
                onClick={() => setDrawerOpen((v) => !v)}
              >
                <Menu size={17} />
              </button>
            </div>
          </div>

          {/* Desktop Horizontal Navigation Row */}
          <div className="mx-auto hidden max-w-7xl items-center justify-between gap-2 px-6 pb-2.5 lg:flex">
            <nav
              aria-label="Үндсэн навигаци"
              className="flex flex-wrap items-center gap-1.5"
            >
              {PRIMARY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={tab.onClick}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition ${
                    tab.active
                      ? "text-white"
                      : "text-white/60 hover:bg-white/8 hover:text-white/90"
                  }`}
                  style={
                    tab.active
                      ? {
                          background: `${accent}2c`,
                          boxShadow: `inset 0 0 0 1px ${accent}55`,
                        }
                      : undefined
                  }
                >
                  <tab.icon size={15} />
                  {tab.label}
                  {tab.badge ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-400 px-1 text-[10px] font-bold text-white">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              {SECONDARY_TABS.map((item) => {
                const isActive = view === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => go(item.view)}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
                      isActive
                        ? "text-white"
                        : "text-white/50 hover:bg-white/8 hover:text-white/85"
                    }`}
                    style={
                      isActive
                        ? {
                            background: `${accent}26`,
                            boxShadow: `inset 0 0 0 1px ${accent}48`,
                          }
                        : undefined
                    }
                  >
                    <item.icon size={13.5} />
                    <span className="hidden xl:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Horizontal Swipeable Quick-Nav Strip (< 1024px) */}
          <div
            role="toolbar"
            aria-label="Гар утасны хурдан шилжилт"
            className="v11-mobile-strip flex items-center gap-1.5 overflow-x-auto px-3 pb-2 lg:hidden"
          >
            {data.activeTimer?.running && (
              <button
                type="button"
                onClick={() => go("focus")}
                className="flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-[11.5px] font-bold text-red-200 ring-1 ring-red-400/40"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                <span>{liveTimerClock}</span>
              </button>
            )}
            {PRIMARY_TABS.map((tab) => (
              <button
                key={`m-${tab.id}`}
                type="button"
                onClick={tab.onClick}
                className={`flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold transition ${
                  tab.active
                    ? "text-white"
                    : "bg-white/[0.06] text-white/75 active:bg-white/15"
                }`}
                style={
                  tab.active
                    ? {
                        background: `${accent}36`,
                        boxShadow: `inset 0 0 0 1px ${accent}75`,
                      }
                    : undefined
                }
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="rounded-full bg-red-400 px-1.5 text-[10px] font-extrabold text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
            {SECONDARY_TABS.map((item) => {
              const isActive = view === item.view;
              return (
                <button
                  key={`ms-${item.view}`}
                  type="button"
                  onClick={() => go(item.view)}
                  className={`flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${
                    isActive
                      ? "text-white"
                      : "bg-white/[0.04] text-white/65 active:bg-white/15"
                  }`}
                  style={
                    isActive
                      ? {
                          background: `${accent}2e`,
                          boxShadow: `inset 0 0 0 1px ${accent}66`,
                        }
                      : undefined
                  }
                >
                  <item.icon size={13} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-10 mx-auto w-full max-w-7xl px-3 pb-28 pt-4 md:px-6 lg:pb-16"
        >
          <div
            className={`page-top ${["overview", "focus"].includes(view) ? "world-page-top" : ""}`}
          >
            <div>
              <span className="eyebrow">{today.replaceAll("-", ".")}</span>
              <h1>{t(titles[view])}</h1>
            </div>
            <TimerWatch />
          </div>

          {state.error && (
            <div className="error-banner" role="alert">
              <Icon name="info" />
              <p>{state.error}</p>
              <button
                className="icon-button"
                aria-label={t("shell.errorClose")}
                onClick={store.clearError}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          )}

          {!state.ready ? (
            state.error ? (
              <RecoveryPanel
                repository={store.repository}
                namespace={state.namespace}
                onRecovered={() => store.switchNamespace(state.namespace)}
              />
            ) : (
              <AppSkeleton />
            )
          ) : (
            <Fragment key={state.namespace}>
              {view === "overview" &&
                (soundSubView ? (
                  <ModuleBoundary name="Дууны систем">
                    <SoundStudioView accent={accent} />
                  </ModuleBoundary>
                ) : (
                  <ModuleBoundary name={t("page.overview")}>
                    <StudyRoom onCelebrate={celebrate} />
                  </ModuleBoundary>
                ))}
              {view === "timer" && (
                <ModuleBoundary name={t("page.timer")}>
                  <StudyTimer key={state.data.activeTimer?.id ?? "new-timer"} />
                </ModuleBoundary>
              )}
              {view === "room" && (
                <ModuleBoundary name={t("page.room")}>
                  <CustomizeRoom />
                </ModuleBoundary>
              )}
              {view === "focus" && (
                <ModuleBoundary name={t("page.focus")}>
                  <StudyRoom focus onCelebrate={celebrate} />
                </ModuleBoundary>
              )}
              {view === "knowledge" && (
                <ModuleBoundary
                  key={selectedRecord ?? "knowledge"}
                  name={t("page.knowledge")}
                >
                  <KnowledgeHub />
                </ModuleBoundary>
              )}
              {view === "privacy" && (
                <ModuleBoundary name={t("page.privacy")}>
                  <PrivacyCenter />
                </ModuleBoundary>
              )}
              {view === "calendar" && (
                <ModuleBoundary
                  key={selectedRecord ?? "calendar"}
                  name={t("page.calendar")}
                >
                  <StudyCalendar />
                </ModuleBoundary>
              )}
              {view === "subjects" && <Subjects />}
              {view === "statistics" && (
                <ModuleBoundary name={t("page.statistics")}>
                  <Statistics />
                </ModuleBoundary>
              )}
              {view === "goals" && <Goals />}
              {view === "achievements" && <Achievements />}
              {view === "assistant" && (
                <ModuleBoundary name={t("page.assistant")}>
                  <Assistant />
                </ModuleBoundary>
              )}
              {view === "settings" && <Settings />}
            </Fragment>
          )}

          <footer className="page-footer">
            <Icon name="leaf" size={15} />
            <span>{t("shell.footer1")}</span>
            <span>TOGTMOL v9</span>
            <span className="legal-links">
              <a href="/privacy">Нууцлал</a>
              <a href="/terms">Нөхцөл</a>
            </span>
          </footer>
        </main>
      </div>

      {/* ── 10 ROOMS QUICK PICKER MODAL ── */}
      {showRooms && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setShowRooms(false)}
        >
          <div
            className="glass-deep anim-pop max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-4 sm:rounded-3xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-[18px] font-bold text-white">
                  10 өрөө — орчноо сонго
                </h2>
                <p className="text-[12px] text-white/55">
                  Өрөө солиход өнгө, арын одод/бороо ба санал болгох дуу таарна.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRooms(false);
                    go("room");
                  }}
                  className="rounded-xl bg-white/8 px-3 py-2 text-[11.5px] font-bold text-white/80 ring-1 ring-white/12 transition hover:bg-white/15"
                >
                  Дэлгэрэнгүй тохиргоо →
                </button>
                <button
                  type="button"
                  onClick={() => setShowRooms(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  aria-label="Хаах"
                >
                  <X size={17} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ROOMS.map((r) => {
                const isCurrent = activeRoomId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setShowRooms(false);
                      void run(() =>
                        store.mutate((d) =>
                          actions.settings({
                            world: {
                              ...d.settings.world,
                              design: r.id,
                              extras: {
                                ...d.settings.world.extras,
                                v9Room: r.id,
                              },
                            },
                          })(d),
                        ),
                      );
                      const p = PRESETS.find((x) => x.id === r.preset);
                      if (p) {
                        engine.applyPreset(p.id);
                        pushToast({
                          title: `${r.emoji} ${r.nameMn}`,
                          desc: `Дуу: ${p.nameMn} 🎶`,
                          emoji: r.emoji,
                        });
                      } else {
                        pushToast({
                          title: `${r.emoji} ${r.nameMn}`,
                          desc: r.greeting,
                          emoji: r.emoji,
                        });
                      }
                    }}
                    className={`group relative overflow-hidden rounded-3xl p-4 text-left ring-1 transition hover:scale-[1.02] ${
                      isCurrent ? "ring-2" : "ring-white/15"
                    }`}
                    style={{
                      background: `linear-gradient(150deg, ${r.bg[1]}, ${r.bg[2]})`,
                      borderColor: isCurrent ? r.accent : undefined,
                    }}
                  >
                    <div
                      className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-40 blur-2xl"
                      style={{ background: r.accent }}
                    />
                    <div className="text-3xl">{r.emoji}</div>
                    <div className="mt-2 font-display text-[14px] font-bold text-white">
                      {r.nameMn}
                    </div>
                    <div className="text-[11px] text-white/60">{r.tagline}</div>
                    {isCurrent && (
                      <span
                        className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: `${r.accent}55` }}
                      >
                        <Play size={10} /> Одоо
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE MORE DIALOG ── */}
      {more && (
        <div
          className="mobile-more"
          id="mobile-more-panel"
          ref={morePanel}
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.more")}
        >
          <button
            className="more-close"
            onClick={closeMore}
            aria-label={t("common.close")}
          />
          <nav aria-label={t("nav.more")}>
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter(
                (n) => !["overview", "knowledge", "assistant"].includes(n.view),
              );
              if (!items.length) return null;
              return (
                <Fragment key={group.label}>
                  <div className="nav-caption nav-group">{t(group.label)}</div>
                  {items.map((n) => (
                    <button key={n.view} onClick={() => go(n.view)}>
                      <Icon name={n.icon} />
                      {t(n.label)}
                    </button>
                  ))}
                </Fragment>
              );
            })}
          </nav>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-nav" aria-label={t("nav.mobileMenu")}>
        {[
          { view: "overview", label: t("nav.home"), icon: "home" },
          { view: "knowledge", label: t("nav.knowledgeShort"), icon: "book" },
          { view: "timer", label: t("nav.focus"), icon: "play" },
          { view: "assistant", label: t("nav.bondook"), icon: "spark" },
        ].map((n) => (
          <button
            key={n.view}
            className={`${view === n.view ? "active" : ""} ${n.view === "timer" ? "mobile-timer" : ""}`}
            aria-current={view === n.view ? "page" : undefined}
            onClick={() => go(n.view as View)}
          >
            <Icon name={n.icon} size={21} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          ref={moreButton}
          aria-expanded={more}
          aria-haspopup="dialog"
          aria-controls="mobile-more-panel"
          onClick={() => (more ? closeMore() : setMore(true))}
        >
          <Icon name="more" size={21} />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {/* ── CORE TOAST REGION ── */}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="toast">
            <Icon name="check" size={19} />
            {notice}
            {undo && (
              <button className="text-button" onClick={() => void run(undo)}>
                {t("common.undo")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── V9 CELEBRATION TOASTS ── */}
      <div
        className="pointer-events-none fixed right-3 top-20 z-[90] flex w-[300px] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className="anim-pop glass-deep pointer-events-auto flex items-start gap-2.5 rounded-2xl p-3 shadow-2xl"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg"
              style={{ background: `${accent}2a` }}
            >
              {item.emoji ?? (
                <PartyPopper size={17} style={{ color: accent }} />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-white">
                {item.title}
              </div>
              {item.desc && (
                <div className="text-[11px] leading-snug text-white/60">
                  {item.desc}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {state.ready && (
        <>
          <VoiceFlowBar
            open={voiceBarOpen}
            onClose={() => setVoiceBarOpen(false)}
            accent={accent}
            onNavigate={(target) => {
              if (target === "sound") {
                setSoundTabRequested(true);
                navigate("overview");
              } else {
                go(target);
              }
            }}
          />
          {authModalTab !== null && (
            <AuthModal
              initialTab={authModalTab}
              onClose={() => setAuthModalTab(null)}
            />
          )}
          {quickToolsOpen && (
            <QuickToolsModal onClose={() => setQuickToolsOpen(false)} />
          )}
          <ModuleBoundary key={state.namespace} name={t("settings.music")}>
            <MusicProvider>
              <MusicPlayer />
            </MusicProvider>
          </ModuleBoundary>
          <EmojiBurstLayer />
        </>
      )}
      <PwaManager />
    </div>
  );
}

export function AppShell() {
  return (
    <LanguageProvider>
      <StudyProvider>
        <AccountProvider>
          <Shell />
        </AccountProvider>
      </StudyProvider>
    </LanguageProvider>
  );
}
