"use client";
import { useStudy } from "@/hooks/use-study";
import { useMusicPreference } from "@/hooks/use-music-preference";
import { AMBIENTS } from "@/lib/music/catalog";
import type { MusicPreferences } from "@/lib/music/preferences";
import { SectionTitle } from "@/components/ui/common";

export function MusicSettings() {
  const { store, data } = useStudy();
  const [preference, update, error] = useMusicPreference(
    store.getSnapshot().namespace,
  );
  const change = (patch: Partial<MusicPreferences>) => {
    void update(patch);
  };
  const last =
    AMBIENTS.find((a) => `ambient:${a.id}` === preference.lastPlayed)?.name ??
    data.musicSources.find(
      (s) => !s.deletedAt && s.id === preference.lastPlayed,
    )?.title;
  return (
    <section className="card">
      <SectionTitle
        title="Хөгжим"
        subtitle="Өөрт тохирсон ая, чимээгээ сонгоорой."
      />
      {error && (
        <p role="status" className="music-error">
          {error}
        </p>
      )}
      <div className="form-stack">
        <label>
          Үндсэн хөгжмийн ангилал
          <select
            value={preference.defaultCategory}
            onChange={(e) =>
              change({
                defaultCategory: e.target
                  .value as MusicPreferences["defaultCategory"],
              })
            }
          >
            <option value="theme">Өрөөний загварт тохируулах</option>
            {AMBIENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Дууны түвшин · {Math.round(preference.volume * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={preference.volume}
            onChange={(e) => change({ volume: Number(e.target.value) })}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={preference.rememberLast}
            onChange={(e) => change({ rememberLast: e.target.checked })}
          />
          Сүүлд тоглуулсан аяыг санах
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={preference.autoNext}
            onChange={(e) => change({ autoNext: e.target.checked })}
          />
          Дуу дуусахад дараагийн дууг автоматаар тоглуулах
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={preference.repeat}
            onChange={(e) => change({ repeat: e.target.checked })}
          />
          Одоогийн дууг давтах
        </label>
        <label>
          Урагш / ухрах алхам
          <select
            value={preference.seekSeconds}
            onChange={(e) =>
              change({
                seekSeconds: Number(e.target.value) as 5 | 10 | 15 | 30,
              })
            }
          >
            <option value={5}>5 секунд</option>
            <option value={10}>10 секунд</option>
            <option value={15}>15 секунд</option>
            <option value={30}>30 секунд</option>
          </select>
        </label>
        <p className="tiny muted">
          Сүүлд тоглуулсан: {last ?? "Одоогоор алга"}. Дараа нээхэд сонголтыг
          сэргээнэ. Аяыг та өөрөө эхлүүлнэ.
        </p>
      </div>
    </section>
  );
}
