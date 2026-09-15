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
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    const handler = (e: Event) => {
      e.preventDefault();
      promptEvent = e as InstallEvent;
      window.dispatchEvent(new Event("togtmol-install-ready"));
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
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
      <p className="tiny muted">
        Эхний удаа интернэттэй нээнэ. Апп бэлэн болсон хойно хичээл, timer,
        тайлан offline ажиллана. Шинэ хувилбарыг бүх цонхыг хааж нээхэд ачаална.
      </p>
    </>
  );
}
