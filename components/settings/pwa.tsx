"use client";
import { useEffect, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { dateKey, studyDate, timeLabel } from "@/lib/calculations/dates";
import { reminderMessage } from "@/lib/reminders";
import { dayBoundary } from "@/lib/preferences";
import { notifyUser } from "@/lib/notifications";
import { Icon } from "@/components/ui/icon";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let promptEvent: InstallEvent | null = null;
export function PwaManager() {
  const { data, store, setNotice, view } = useStudy();
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setNotice(
            "Интернэтгүй ажиллах хувилбарыг бэлтгэж чадсангүй. Холболттой үед дахин нээнэ үү.",
          ),
        );
    const handler = (e: Event) => {
      e.preventDefault();
      promptEvent = e as InstallEvent;
      window.dispatchEvent(new Event("togtmol-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [setNotice]);
  useEffect(() => {
    let disposed = false,
      pending = false;
    const tick = async () => {
      if (pending || disposed || document.hidden) return;
      pending = true;
      try {
        const snapshot = store.getSnapshot();
        if (!snapshot.ready) return;
        const settings = snapshot.data.settings,
          now = new Date(),
          day = dateKey(now),
          namespace = snapshot.namespace;
        if (
          settings.notifications &&
          settings.reminderTime &&
          timeLabel(now.getTime()) >= settings.reminderTime &&
          (await store.repository.claimOnce(`reminded:${namespace}`, day))
        ) {
          if (disposed || store.getSnapshot().namespace !== namespace) return;
          const message = reminderMessage(
            snapshot.data,
            studyDate(now, dayBoundary(settings)),
          );
          notifyUser(message, settings, `togtmol:${namespace}:${day}`);
          setNotice(message);
        }
        if (settings.extras.backupReminder === true) {
          const exported =
            (await store.repository.metadata<number>(
              `last-export:${namespace}`,
            )) ?? 0;
          if (
            now.getTime() - exported >= 14 * 86400000 &&
            (await store.repository.claimOnce(
              `backup-reminder:${namespace}`,
              day,
            ))
          ) {
            if (!disposed && store.getSnapshot().namespace === namespace)
              setNotice(
                "Өгөгдлийнхөө зөөврийн нөөцийг татаж авах уу? Нууцлал ба өгөгдөл хэсгээс JSON нөөцөө аваарай.",
              );
          }
        }
      } catch {
        /* Optional reminders must never interrupt local work. */
      } finally {
        pending = false;
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 15000);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [store, data.settings, setNotice]);
  return <InstallPrompt hidden={view === "settings"} />;
}

function InstallPrompt({ hidden = false }: { hidden?: boolean }) {
  const [available, setAvailable] = useState(false),
    [dismissed, setDismissed] = useState(false),
    { setNotice } = useStudy();
  useEffect(() => {
    const update = () => setAvailable(Boolean(promptEvent));
    update();
    window.addEventListener("togtmol-install-ready", update);
    return () => window.removeEventListener("togtmol-install-ready", update);
  }, []);
  if (hidden || dismissed || !available) return null;
  return (
    <aside className="pwa-install-prompt" aria-label="Тогтмол апп суулгах урилга">
      <span className="pwa-install-icon" aria-hidden="true">
        <Icon name="download" size={18} />
      </span>
      <div>
        <strong>Тогтмол-оо суулгаарай</strong>
        <p>Нүүр дэлгэцээс хурдан нээгээд offline үед ч аппын суурь хэсгийг ашиглаарай.</p>
      </div>
      <div className="pwa-install-actions">
        <button
          className="button primary small"
          onClick={async () => {
            if (!promptEvent) return;
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            promptEvent = null;
            setAvailable(false);
            setNotice(
              choice.outcome === "accepted"
                ? "Тогтмол суулгалтыг эхлүүллээ."
                : "Суулгалтыг дараа нь Тохиргоо хэсгээс эхлүүлж болно.",
            );
          }}
        >
          Суулгах
        </button>
        <button
          className="icon-button"
          aria-label="Суулгах урилгыг хаах"
          onClick={() => setDismissed(true)}
        >
          <Icon name="close" size={17} />
        </button>
      </div>
    </aside>
  );
}
export function InstallButton() {
  const [available, setAvailable] = useState(false),
    { setNotice } = useStudy();
  useEffect(() => {
    const update = () => setAvailable(Boolean(promptEvent));
    update();
    window.addEventListener("togtmol-install-ready", update);
    return () => window.removeEventListener("togtmol-install-ready", update);
  }, []);
  return (
    <>
      <button
        className="button"
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            promptEvent = null;
            setAvailable(false);
          } else
            setNotice(
              "Браузерын цэсээс “Install app” эсвэл “Add to Home Screen” сонгоно уу.",
            );
        }}
      >
        <Icon name="download" />
        {available ? "Апп суулгах" : "Нүүр дэлгэцэд нэмэх"}
      </button>
      <OfflineReadiness />
    </>
  );
}

function OfflineReadiness() {
  const [state, setState] = useState(
    "Интернэтгүй ажиллах бэлтгэлийг шалгаж байна…",
  );
  useEffect(() => {
    let disposed = false;
    const workers = new Map<ServiceWorker, () => void>();
    let registration: ServiceWorkerRegistration | undefined;
    const inspect = () => {
      if (disposed || !registration) return;
      setState(
        registration.waiting
          ? "Шинэ хувилбар бэлэн. Нээлттэй цонхуудаа хааж дахин нээхэд шинэчлэгдэнэ."
          : registration.active
            ? "Үндсэн аппын интернэтгүй ажиллах файлууд бэлэн. YouTube, онлайн AI болон синк хийхэд интернет хэрэгтэй."
            : "Интернэтгүй ажиллах файлуудыг бэлтгэж байна…",
      );
      for (const worker of [registration.installing, registration.waiting])
        if (worker && !workers.has(worker)) {
          const changed = () => inspect();
          workers.set(worker, changed);
          worker.addEventListener("statechange", changed);
        }
    };
    const check = async () => {
      if (process.env.NODE_ENV !== "production") {
        if (!disposed)
          setState(
            "Интернэтгүй ажиллах хувилбар нь байршуулсан аппад бэлтгэгдэнэ.",
          );
        return;
      }
      if (!("serviceWorker" in navigator)) {
        if (!disposed)
          setState(
            "Энэ браузерт интернэтгүй ажиллах боломж дэмжигдээгүй байна.",
          );
        return;
      }
      try {
        registration = await navigator.serviceWorker.getRegistration();
        if (disposed) return;
        if (!registration) {
          setState(
            "Интернэтгүй ажиллах хувилбар одоогоор бэлэн болоогүй. Холболттой үед дахин нээнэ үү.",
          );
          return;
        }
        registration.addEventListener("updatefound", inspect);
        inspect();
      } catch {
        if (!disposed)
          setState("Интернэтгүй ажиллах бэлтгэлийг баталгаажуулж чадсангүй.");
      }
    };
    void check();
    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", inspect);
      workers.forEach((fn, worker) =>
        worker.removeEventListener("statechange", fn),
      );
    };
  }, []);
  return (
    <p className="tiny muted" role="status">
      {state}
    </p>
  );
}
