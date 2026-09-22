"use client";
import { useEffect, useRef, useState } from "react";
import { useStudy } from "@/hooks/use-study";
import { completionVolume } from "@/lib/preferences";
import {
  playTimerComplete,
  stopTimerAlertSound,
  testTimerNotification,
} from "@/lib/notifications";
import {
  TIMER_CHIMES,
  TIMER_DESIGNS,
  timerChime,
  timerDesign,
} from "@/lib/timer-alerts";
import "@/components/timer/timer.css";

export function TimerSoundSettings() {
  const { data, store, run } = useStudy();
  const settings = data.settings;
  const preview = useRef(false);
  const previewRequest = useRef(0);
  const [previewMessage, setPreviewMessage] = useState("");
  useEffect(
    () => () => {
      if (preview.current) stopTimerAlertSound();
      preview.current = false;
    },
    [],
  );
  const update = (key: string, value: unknown) =>
    run(() =>
      store.mutate((d) => ({
        ...d,
        settings: {
          ...d.settings,
          updatedAt: Date.now(),
          extras: { ...d.settings.extras, [key]: value },
        },
      })),
    );
  return (
    <fieldset className="timer-sound-settings form-stack">
      <legend>Таймерын дуу ба харагдац</legend>
      <label>
        Дуусах аялгуу
        <select
          value={timerChime(settings).id}
          onChange={(event) => {
            stopTimerAlertSound();
            void update("timerChime", event.target.value);
          }}
        >
          {TIMER_CHIMES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="tiny muted">
        Дуусах дуу нэг удаа тоглоно. Эцсийн мөчид зөөлөн, гэгээлэг аялгуугаар дуусгана.
      </p>
      <label>
        Дуусах дохионы түвшин · {Math.round(completionVolume(settings) * 100)}%
        <input
          aria-label="Дуусах дохионы түвшин"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={completionVolume(settings)}
          onChange={(event) => {
            stopTimerAlertSound();
            void update("completionVolume", Number(event.target.value));
          }}
        />
      </label>
      {!settings.sound && (
        <p className="tiny muted">
          Таймерын дуу унтраалттай. Туршилт дуугарна; таймер дуусахад дуу
          гаргахын тулд дууг асаана уу.
        </p>
      )}
      <div className="timer-sound-buttons">
        <button
          type="button"
          className="button"
          disabled={Boolean(data.activeTimer?.running)}
          onClick={() => {
            preview.current = true;
            const request = ++previewRequest.current;
            setPreviewMessage("");
            void playTimerComplete({ ...settings, sound: true }, true).then(
              (played) => {
                if (
                  preview.current &&
                  request === previewRequest.current &&
                  !played
                )
                  setPreviewMessage(
                    completionVolume(settings) === 0
                      ? "Дууны түвшин 0% байна."
                      : "Дуу идэвхжсэнгүй. Браузер болон төхөөрөмжийн дууны тохиргоог шалгаад дахин туршина уу.",
                  );
              },
            );
          }}
        >
          ▶ Аялгууг турших
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            preview.current = false;
            stopTimerAlertSound();
          }}
        >
          🔇 Дууг зогсоох
        </button>
      </div>
      {previewMessage && (
        <p role="status" className="tiny muted">
          {previewMessage}
        </p>
      )}
      {data.activeTimer?.running && (
        <p className="tiny muted">
          Аялгуу туршихын өмнө таймераа түр зогсооно уу.
        </p>
      )}
      {[
        ["timerVibration", "Чичиргээгээр мэдэгдэх"],
        ["timerCountdown", "Сүүлийн 10 секундыг томоор тоолох"],
        ["timerCountdownSound", "Тоолох бүрд зөөлөн дуу гаргах"],
      ].map(([key, label]) => (
        <label key={key} className="check-label">
          <input
            type="checkbox"
            checked={settings.extras[key] !== false}
            onChange={(event) => {
              stopTimerAlertSound();
              void update(key, event.target.checked);
            }}
          />
          {label}
        </label>
      ))}
      <p className="tiny muted">
        Чичиргээ нь төхөөрөмжийн дэмжлэгээс хамаарна. Тооллын дуу нь таймерын
        үндсэн дууны тохиргоог дагана.
      </p>
      <label>
        Таймерын загвар
        <select
          value={timerDesign(settings)}
          onChange={(event) => void update("timerDesign", event.target.value)}
        >
          {TIMER_DESIGNS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div
        className={`timer-design-preview timer-design-${timerDesign(settings)}`}
        aria-label="Таймерын загварын жишээ"
      >
        <div className="timer-orbit">
          <span className="timer-type">ТӨВЛӨРӨЛ</span>
          <span className="timer-digits">25:00</span>
        </div>
      </div>
      <details>
        <summary>Утас түгжээтэй үеийн мэдэгдэл</summary>
        <p className="tiny muted">
          iPhone дээр Safari → Хуваалцах → Үндсэн дэлгэцэд нэмэх гэж суулгаад,
          мэдэгдлийг зөвшөөрнө. Утасны тохиргооноос түгжээтэй дэлгэцэд
          харагдахыг мөн зөвшөөрнө.
        </p>
        <p className="tiny muted">
          Одоогоор серверээс товлосон мэдэгдэл илгээх үйлчилгээ холбогдоогүй.
          Утас түгжигдэж аппын ажиллагаа зогсвол дохио хоцорч болно. Яг цагтаа
          дуугарах шаардлагатай бол утасныхаа үндсэн таймерыг давхар ашиглаарай.
        </p>
        <button
          type="button"
          className="button"
          onClick={() => void run(() => testTimerNotification(settings))}
        >
          Мэдэгдэл турших
        </button>
      </details>
    </fieldset>
  );
}
