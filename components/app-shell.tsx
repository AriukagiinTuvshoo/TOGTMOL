"use client";
import dynamic from "next/dynamic";
import { Fragment, useState } from "react";
import { StudyProvider, useStudy, useStoreState } from "@/hooks/use-study";
import { AccountProvider, useAccount } from "@/hooks/use-account";
import type { View } from "@/types/study";
import { Icon } from "./ui/icon";
import { ModuleBoundary } from "./ui/module-boundary";
import { RecoveryPanel } from "./settings/recovery";
import { GlobalSearch } from "./knowledge/search";
import { StudyRoom } from "./world/study-room";
import { MusicPlayer, MusicProvider } from "./music/music-player";
const KnowledgeHub = dynamic(
  () => import("./knowledge/hub").then((m) => m.KnowledgeHub),
  { loading: () => <p role="status">Мэдлэгийн санг нээж байна…</p> },
);
const PrivacyCenter = dynamic(
  () => import("./settings/privacy").then((m) => m.PrivacyCenter),
  { loading: () => <p role="status">Нууцлалын тохиргоог нээж байна…</p> },
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
const NAV: { view: View; label: string; icon: string }[] = [
  { view: "overview", label: "Миний өрөө", icon: "home" },
  { view: "knowledge", label: "Миний мэдлэг", icon: "book" },
  { view: "calendar", label: "Календарь", icon: "calendar" },
  { view: "subjects", label: "Хичээлүүд", icon: "book" },
  { view: "statistics", label: "Статистик", icon: "chart" },
  { view: "goals", label: "Зорилго", icon: "target" },
  { view: "achievements", label: "Амжилт", icon: "award" },
  { view: "assistant", label: "Суралцах туслах", icon: "spark" },
  { view: "room", label: "Өрөөний загвар", icon: "sun" },
  { view: "privacy", label: "Нууцлал ба өгөгдөл", icon: "shield" },
  { view: "settings", label: "Тохиргоо", icon: "settings" },
];
const titles: Record<View, string> = {
  overview: "Миний өдөр",
  timer: "Төвлөрөх цаг",
  calendar: "Суралцах календарь",
  subjects: "Миний хичээлүүд",
  statistics: "Таны ахиц, тоогоор",
  goals: "Миний зорилго",
  achievements: "Таны жижиг ялалтууд",
  assistant: "Суралцах туслах",
  settings: "Өөрийн хэмнэлээр",
  room: "Таны жижиг ертөнц",
  focus: "Төвлөрөх орон зай",
  knowledge: "Миний мэдлэг",
  privacy: "Нууцлал ба өгөгдөл",
};
function Shell() {
  const { view, navigate, today, store, notice, run, undo, selectedRecord } =
      useStudy(),
    state = useStoreState(),
    { status, user } = useAccount(),
    [more, setMore] = useState(false);
  const go = (v: View) => {
    navigate(v);
    setMore(false);
  };
  return (
    <div className={`app-shell ${view === "focus" ? "is-focus" : ""}`}>
      <a className="skip-link" href="#main-content">
        Үндсэн хэсэг рүү
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
        <div className="nav-caption">МИНИЙ ОРОН ЗАЙ</div>
        <nav aria-label="Үндсэн цэс">
          {NAV.map((n) => (
            <button
              key={n.view}
              className={view === n.view ? "active" : ""}
              aria-current={view === n.view ? "page" : undefined}
              onClick={() => go(n.view)}
            >
              <Icon name={n.icon} />
              {n.label}
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
              Тогтмол байдал
              <br />
              төгсөөс чухал.
            </p>
          </div>
          <button className="profile-button" onClick={() => go("settings")}>
            <span className="avatar">
              <Icon name={user ? "user" : "leaf"} size={19} />
            </span>
            <span>
              <strong>
                {state.namespace === "guest"
                  ? "Миний төхөөрөмж"
                  : (user?.email?.split("@")[0] ?? "Миний бүртгэл")}
              </strong>
              <small>
                {state.namespace === "guest" ? "Локал горим" : "Бүртгэлтэй"}
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
              Миний орон зай <span>/</span> {titles[view]}
            </span>
          </div>
          <div className="topbar-right">
            {state.ready && (
              <ModuleBoundary name="Хайлт">
                <GlobalSearch />
              </ModuleBoundary>
            )}
            <span className="save-status">
              <span className="status-dot" />
              {state.busy
                ? "Хадгалж байна…"
                : state.namespace === "guest"
                  ? "Локал хадгалалт"
                  : status}
            </span>
            <button
              className="icon-button"
              aria-label="Тохиргоо нээх"
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
              <h1>{titles[view]}</h1>
            </div>
            <TimerWatch />
          </div>
          {state.error && (
            <div className="error-banner" role="alert">
              <Icon name="info" />
              <p>{state.error}</p>
              <button
                className="icon-button"
                aria-label="Алдааны мэдэгдэл хаах"
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
              <section className="card loading-card">
                <span className="brand-mark">
                  <Icon name="leaf" size={28} />
                </span>
                <h2>Таны орон зайг нээж байна…</h2>
                <p>Өмнөх алхмуудыг тань ачаалж байна.</p>
              </section>
            )
          ) : (
            <Fragment key={state.namespace}>
              {view === "overview" && (
                <ModuleBoundary name="Өнөөдрийн өрөө">
                  <StudyRoom />
                </ModuleBoundary>
              )}
              {view === "timer" && (
                <ModuleBoundary name="Цаг хэмжигч">
                  <StudyTimer key={state.data.activeTimer?.id ?? "new-timer"} />
                </ModuleBoundary>
              )}
              {view === "room" && (
                <ModuleBoundary name="Өрөөний загвар">
                  <CustomizeRoom />
                </ModuleBoundary>
              )}
              {view === "focus" && (
                <ModuleBoundary name="Төвлөрөх өрөө">
                  <StudyRoom focus />
                </ModuleBoundary>
              )}
              {view === "knowledge" && (
                <ModuleBoundary
                  key={selectedRecord ?? "knowledge"}
                  name="Мэдлэгийн сан"
                >
                  <KnowledgeHub />
                </ModuleBoundary>
              )}
              {view === "privacy" && (
                <ModuleBoundary name="Нууцлал">
                  <PrivacyCenter />
                </ModuleBoundary>
              )}
              {view === "calendar" && (
                <ModuleBoundary
                  key={selectedRecord ?? "calendar"}
                  name="Календарь"
                >
                  <StudyCalendar />
                </ModuleBoundary>
              )}
              {view === "subjects" && <Subjects />}
              {view === "statistics" && (
                <ModuleBoundary name="Статистик">
                  <Statistics />
                </ModuleBoundary>
              )}
              {view === "goals" && <Goals />}
              {view === "achievements" && <Achievements />}
              {view === "assistant" && (
                <ModuleBoundary name="Бондоок">
                  <Assistant />
                </ModuleBoundary>
              )}
              {view === "settings" && <Settings />}
            </Fragment>
          )}
          <footer className="page-footer">
            <Icon name="leaf" size={15} />
            <span>Өнөөдөр бага байсан ч ахиц.</span>
            <span>Тогтмол v6.0</span>
          </footer>
        </main>
      </div>
      {more && (
        <div className="mobile-more">
          <button
            className="more-close"
            onClick={() => setMore(false)}
            aria-label="Нэмэлт цэс хаах"
          />
          <nav aria-label="Нэмэлт цэс">
            {NAV.filter(
              (n) => !["overview", "knowledge", "assistant"].includes(n.view),
            ).map((n) => (
              <button key={n.view} onClick={() => go(n.view)}>
                <Icon name={n.icon} />
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      )}
      <nav className="mobile-nav" aria-label="Гар утасны цэс">
        {[
          { view: "overview", label: "Нүүр", icon: "home" },
          { view: "knowledge", label: "Мэдлэг", icon: "book" },
          { view: "timer", label: "Төвлөрөх", icon: "play" },
          { view: "assistant", label: "Бондоок", icon: "spark" },
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
          <span>Бусад</span>
        </button>
      </nav>
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="toast">
            <Icon name="check" size={19} />
            {notice}
            {undo && (
              <button className="text-button" onClick={() => void run(undo)}>
                Буцаах
              </button>
            )}
          </div>
        )}
      </div>
      {state.ready && (
        <ModuleBoundary key={state.namespace} name="Хөгжим">
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
    <StudyProvider>
      <AccountProvider>
        <Shell />
      </AccountProvider>
    </StudyProvider>
  );
}
