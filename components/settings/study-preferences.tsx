"use client";
import { useStudy } from "@/hooks/use-study";
import { dayBoundary } from "@/lib/preferences";
import { TimerSoundSettings } from "./timer-sound-settings";
export function StudyPreferences() {
  const { data, store, run } = useStudy();
  const update = (key: string, value: unknown) =>
    run(
      () =>
        store.mutate((d) => ({
          ...d,
          settings: {
            ...d.settings,
            updatedAt: Date.now(),
            extras: { ...d.settings.extras, [key]: value },
          },
        })),
      "Тохиргоо хадгаллаа.",
    );
  return (
    <section className="card form-stack">
      <span className="eyebrow">ӨӨРИЙН ХЭМНЭЛ</span>
      <h2>Хугацаа ба сануулга</h2>
      <label className="check-label">
        <input
          type="checkbox"
          checked={data.settings.extras.wakeLock === true}
          onChange={(e) => void update("wakeLock", e.target.checked)}
        />
        Хичээллэх үед дэлгэцийг сэрүүн байлгах
      </label>
      <p className="tiny muted">
        Браузер зөвшөөрсөн үед ажиллана. Цонх далдрах, цэнэг бага байх үед
        төхөөрөмж цуцалж болно.
      </p>
      <TimerSoundSettings />
      <label>
        Суралцах өдөр эхлэх цаг
        <select
          value={dayBoundary(data.settings)}
          onChange={(e) =>
            void update("studyDayBoundary", Number(e.target.value))
          }
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </label>
      <p className="tiny muted">
        Төхөөрөмжийн цагийн бүсийг ашиглана. Жишээ нь 04:00 сонговол шөнийн
        02:00-ийн хэмжилт өмнөх суралцах өдөрт тооцогдоно. Гараар сонгосон
        огноотой бичлэг хэвээр үлдэнэ.
      </p>
      <label>
        Дараалалдаа зөвшөөрөх амралтын өдөр
        <select
          value={Number(data.settings.extras.graceDays ?? 1)}
          onChange={(e) => void update("graceDays", Number(e.target.value))}
        >
          <option value={0}>Амралтын өдөр тооцохгүй</option>
          <option value={1}>1 өдөр</option>
          <option value={2}>2 өдөр</option>
        </select>
      </label>
      <p className="tiny muted">
        Амралтын өдөр суралцсан минут нэмэхгүй. Бодит дараалал статистикт тусдаа
        харагдана.
      </p>
      <fieldset>
        <legend>Өдрийн сануулгад оруулах зүйл</legend>
        {[
          ["remindPlan", "Өдрийн төлөвлөгөө"],
          ["remindCards", "Давтах карт"],
          ["remindGoals", "Дөхөж буй зорилгын хугацаа"],
        ].map(([key, label]) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={data.settings.extras[key] === true}
              onChange={(e) => void update(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="tiny muted">
        Сануулах цагт нэгтгэсэн нэг мэдэгдэл өгнө. Апп бүрэн хаагдсан үед
        мэдэгдэл хүрэхийг батлахгүй.
      </p>
    </section>
  );
}
