"use client";
import dynamic from "next/dynamic";
import { Fragment, useEffect, useState } from "react";
import { StudyProvider, useStudy, useStoreState } from "@/hooks/use-study";
import { AccountProvider, useAccount } from "@/hooks/use-account";
import type { View } from "@/types/study";
import { Icon } from "./ui/icon";
import { AppSkeleton } from "./ui/app-skeleton";
import { actions } from "@/lib/persistence/actions";
import { elapsed } from "@/lib/calculations/timer";
import { enableSound } from "@/lib/notifications";
import { ModuleBoundary } from "./ui/module-boundary";
import { RecoveryPanel } from "./settings/recovery";
import { GlobalSearch } from "./knowledge/search";
import { StudyRoom } from "./world/study-room";
import { MusicPlayer, MusicProvider } from "./music/music-player";
import { LanguageProvider, useI18n } from "./i18n/language-provider";
import { LanguageSwitcher } from "./i18n/language-switcher";
import type { TranslationKey } from "@/lib/i18n/dictionary";
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
import { StudyTimer, TimerWatch } from "./timer/study-timer";
import { StudyCalendar } from "./calendar/study-calendar";
import { Subjects } from "./subjects/subjects";
const Statistics = dynamic(() =>
  import("./statistics/statistics").then((m) => m.Statistics),
);
import { Goals } from "./goals/goals";
import { Achievements } from "./achievements/achievements";
import { Settings } from "./settings/settings";
const Assistant = dynamic(() =>
  import("./assistant/chat").then((m) => m.BondookChat),
);
import { PwaManager } from "./settings/pwa";
const NAV: { view: View; label: TranslationKey; icon: string }[] = [
  { view: "overview", label: "nav.overview", icon: "home" },
  { view: "knowledge", label: "nav.knowledge", icon: "book" },
  { view: "calendar", label: "nav.calendar", icon: "calendar" },
  { view: "subjects", label: "nav.subjects", icon: "book" },
  { view: "statistics", label: "nav.statistics", icon: "chart" },
  { view: "goals", label: "nav.goals", icon: "target" },
  { view: "achievements", label: "nav.achievements", icon: "award" },
  { view: "assistant", label: "nav.assistant", icon: "spark" },
  { view: "room", label: "nav.room", icon: "sun" },
  { view: "privacy", label: "nav.privacy", icon: "shield" },
  { view: "settings", label: "nav.settings", icon: "settings" },
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
    } = useStudy(),
    state = useStoreState(),
    { status, user } = useAccount(),
    { t } = useI18n(),
    [more, setMore] = useState(false);
  const go = (v: View) => {
    navigate(v);
    setMore(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
  return (
    <div className={`app-shell ${view === "focus" ? "is-focus" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("shell.skip")}
      </a>
      <aside className="sidebar">
        <button className="brand" onClick={() => go("overview")}>
          <span className="brand-mark">
            <Icon name="leaf" size={24} />
          </span>
          <span>
            тогтмол<span className="brand-version">STUDY WORLD · 06</span>
          </span>
        </button>
        <div className="nav-caption">{t("shell.mySpace")}</div>
        <nav aria-label={t("shell.mySpace")}>
          {NAV.map((n) => (
            <button
              key={n.view}
              className={view === n.view ? "active" : ""}
              aria-current={view === n.view ? "page" : undefined}
              onClick={() => go(n.view)}
            >
              <Icon name={n.icon} />
              {t(n.label)}
              {n.view === "assistant" && (
                <span className="nav-tag" aria-hidden="true">
                  LOCAL
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Icon name="leaf" size={23} />
            <p>
              {t("shell.quote1")}
              <br />
              {t("shell.quote2")}
            </p>
          </div>
          <button className="profile-button" onClick={() => go("settings")}>
            <span className="avatar">
              <Icon name={user ? "user" : "leaf"} size={19} />
            </span>
            <span>
              <strong>
                {state.namespace === "guest"
                  ? t("shell.device")
                  : (user?.email?.split("@")[0] ?? t("shell.myAccount"))}
              </strong>
              <small>
                {state.namespace === "guest" ? t("common.local") : t("shell.account")}
              </small>
            </span>
            <Icon name="settings" size={17} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span className="mobile-brand">тогтмол</span>
            <span className="desktop-breadcrumb">
              {t("shell.mySpace")} <span>/</span> {t(titles[view])}
            </span>
          </div>
          <div className="topbar-right">
            {state.ready && (
              <ModuleBoundary name={t("search.module")}>
                <GlobalSearch />
              </ModuleBoundary>
            )}
            <LanguageSwitcher compact />
            <span className="save-status">
              <span className="status-dot" />
              {state.busy
                ? t("shell.saveBusy")
                : state.namespace === "guest"
                  ? t("shell.localStorage")
                  : status}
            </span>
            <button
              className="icon-button"
              aria-label={t("shell.settings")}
              onClick={() => go("settings")}
            >
              <Icon name="user" size={20} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
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
              {view === "overview" && (
                <ModuleBoundary name={t("page.overview")}>
                  <StudyRoom />
                </ModuleBoundary>
              )}
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
                  <StudyRoom focus />
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
            <span>TOGTMOL v7</span>
          </footer>
        </main>
      </div>
      {more && (
        <div className="mobile-more">
          <button
            className="more-close"
            onClick={() => setMore(false)}
            aria-label={t("common.close")}
          />
          <nav aria-label={t("nav.more")}>
            {NAV.filter(
              (n) => !["overview", "knowledge", "assistant"].includes(n.view),
            ).map((n) => (
              <button key={n.view} onClick={() => go(n.view)}>
                <Icon name={n.icon} />
                {t(n.label)}
              </button>
            ))}
          </nav>
        </div>
      )}
      <nav className="mobile-nav" aria-label={t("nav.more")}>
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
        <button aria-expanded={more} onClick={() => setMore(!more)}>
          <Icon name="more" size={21} />
          <span>{t("nav.more")}</span>
        </button>
      </nav>
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
      {state.ready && (
        <ModuleBoundary key={state.namespace} name={t("settings.music")}>
          <MusicProvider>
            <MusicPlayer />
          </MusicProvider>
        </ModuleBoundary>
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
