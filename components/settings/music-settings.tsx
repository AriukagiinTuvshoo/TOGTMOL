"use client";
import { useStudy } from "@/hooks/use-study";
import { useMusicPreference } from "@/hooks/use-music-preference";
import { AMBIENTS } from "@/lib/music/catalog";
import type { MusicPreferences } from "@/lib/music/preferences";
import { SectionTitle } from "@/components/ui/common";
import { useI18n } from "@/components/i18n/language-provider";

export function MusicSettings() {
  const { store, data } = useStudy();
  const { language } = useI18n();
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
        title={language === "en" ? "Music" : "Хөгжим"}
        subtitle={language === "en" ? "Choose sounds and music that fit your study." : "Өөрт тохирсон ая, чимээгээ сонгоорой."}
      />
      {error && (
        <p role="status" className="music-error">
          {error}
        </p>
      )}
      <div className="form-stack">
        <label>
          {language === "en" ? "Default music category" : "Үндсэн хөгжмийн ангилал"}
          <select
            value={preference.defaultCategory}
            onChange={(e) =>
              change({
                defaultCategory: e.target
                  .value as MusicPreferences["defaultCategory"],
              })
            }
          >
            <option value="theme">{language === "en" ? "Match room theme" : "Өрөөний загварт тохируулах"}</option>
            {AMBIENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {language === "en" ? "Volume" : "Дууны түвшин"} · {Math.round(preference.volume * 100)}%
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
          {language === "en" ? "Remember last played sound" : "Сүүлд тоглуулсан аяыг санах"}
        </label>
        <p className="tiny muted">
          {language === "en"
            ? `Last played: ${last ?? "None yet"}. Your choice will be restored next time. Playback always starts from your action.`
            : `Сүүлд тоглуулсан: ${last ?? "Одоогоор алга"}. Дараа нээхэд сонголтыг сэргээнэ. Аяыг та өөрөө эхлүүлнэ.`}
        </p>
      </div>
    </section>
  );
}
