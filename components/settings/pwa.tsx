"use client";
import { useEffect, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { dateKey, timeLabel } from "@/lib/calculations/dates";
import { notifyUser } from "@/lib/notifications";
import { Icon } from "@/components/ui/icon";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let promptEvent: InstallEvent | null = null;
export function PwaManager() {
  const { data, setNotice } = useStudy();
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
    const settings = data.settings;
    if (!settings.notifications || !settings.reminderTime) return;
    const tick = () => {
      const now = new Date(),
        key = `togtmol:reminded:${dateKey(now)}`;
      try {
        if (
          timeLabel(now.getTime()) === settings.reminderTime &&
          !localStorage.getItem(key)
        ) {
          localStorage.setItem(key, "1");
          notifyUser("Өнөөдөр нэг жижиг алхам хийх үү?", settings);
          setNotice("Өөртөө хэдэн минут зориулах цаг боллоо.");
        }
      } catch {}
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [data.settings, setNotice]);
  return null;
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
