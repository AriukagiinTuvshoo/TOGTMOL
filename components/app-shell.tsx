"use client";
import dynamic from "next/dynamic";
import { Fragment, useState } from "react";
import { StudyProvider, useStudy, useStoreState } from "@/hooks/use-study";
import { AccountProvider, useAccount } from "@/hooks/use-account";
import type { View } from "@/types/study";
import { Icon } from "./ui/icon";
import { downloadJson } from "./ui/common";
import { StudyRoom } from "./world/study-room";
import { MusicPlayer } from "./music/music-player";
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
  import("./assistant/chat").then((m) => m.TogiChat),
);
import { PwaManager } from "./settings/pwa";
const NAV: { view: View; label: string; icon: string }[] = [
  { view: "overview", label: "Миний өрөө", icon: "home" },
  { view: "calendar", label: "Календарь", icon: "calendar" },
  { view: "subjects", label: "Хичээлүүд", icon: "book" },
  { view: "statistics", label: "Статистик", icon: "chart" },
  { view: "goals", label: "Зорилго", icon: "target" },
  { view: "achievements", label: "Амжилт", icon: "award" },
  { view: "assistant", label: "Суралцах туслах", icon: "spark" },
  { view: "room", label: "Өрөөний загвар", icon: "sun" },
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
  focus: "Focus mode",
};
function Shell() {
  const { view, navigate, today, store, notice, run } = useStudy(),
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
            тогтмол<span className="brand-version">STUDY WORLD · 04</span>
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
              {n.view === "assistant" && <span className="nav-tag">LOCAL</span>}
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
            <section className="card loading-card">
              <span className="brand-mark">
                <Icon name="leaf" size={28} />
              </span>
              <h2>
                {state.error
                  ? "Өгөгдлөө эхлээд шалгая"
                  : "Таны орон зайг нээж байна…"}
              </h2>
              <p className="muted">
                {state.error
                  ? "Эх өгөгдлийг өөрчлөхгүйгээр хадгалсан. Нөөцөө татаж аваад дахин оролдоно уу."
                  : "Өмнөх алхмуудыг тань ачаалж байна."}
              </p>
              {state.error && (
                <div className="button-row center">
                  <button
                    className="button"
                    onClick={() =>
                      run(async () =>
                        downloadJson(
                          await store.repository.rawDocument(state.namespace),
                          "togtmol-raw-recovery.json",
                        ),
                      )
                    }
                  >
                    Эх өгөгдлөө татах
                  </button>
                  <button
                    className="button primary"
                    onClick={() => store.initialize()}
                  >
                    Дахин оролдох
                  </button>
                </div>
              )}
            </section>
          ) : (
            <Fragment key={state.namespace}>
              {view === "overview" && <StudyRoom />}
              {view === "timer" && (
                <StudyTimer key={state.data.activeTimer?.id ?? "new-timer"} />
              )}
              {view === "room" && <CustomizeRoom />}
              {view === "focus" && <StudyRoom focus />}
              {view === "calendar" && <StudyCalendar />}
              {view === "subjects" && <Subjects />}
              {view === "statistics" && <Statistics />}
              {view === "goals" && <Goals />}
              {view === "achievements" && <Achievements />}
              {view === "assistant" && <Assistant />}
              {view === "settings" && <Settings />}
            </Fragment>
          )}
          <footer className="page-footer">
            <Icon name="leaf" size={15} />
            <span>Өнөөдөр бага байсан ч ахиц.</span>
            <span>Тогтмол v4</span>
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
              (n) => !["overview", "calendar", "assistant"].includes(n.view),
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
          { view: "calendar", label: "Календарь", icon: "calendar" },
          { view: "timer", label: "Timer", icon: "play" },
          { view: "assistant", label: "AI · Тоги", icon: "spark" },
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
          </div>
        )}
      </div>
      {state.ready && <MusicPlayer key={state.namespace} />}
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
