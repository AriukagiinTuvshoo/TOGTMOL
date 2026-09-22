"use client";
import { StudyPreferences } from "./study-preferences";
import { useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { actions } from "@/lib/persistence/actions";
import { dateKey, formatTime } from "@/lib/calculations/dates";
import { migrate } from "@/lib/migration/migrate";
import { mergeData, resolveConflict } from "@/lib/migration/merge";
import { enableSound } from "@/lib/notifications";
import type { Backup } from "@/lib/persistence/repository";
import type { StudyData, Theme } from "@/types/study";
import { downloadJson, Modal, SectionTitle } from "@/components/ui/common";
import { Icon } from "@/components/ui/icon";
import { AccountPanel } from "./account-panel";
import { InstallButton } from "./pwa";
import { MusicSettings } from "./music-settings";
export function Settings() {
  const { data, store, run, navigate } = useStudy(),
    { namespace } = useStoreState();
  const [focus, setFocus] = useState(String(data.settings.focusMinutes)),
    [short, setShort] = useState(String(data.settings.shortBreakMinutes)),
    [long, setLong] = useState(String(data.settings.longBreakMinutes)),
    [time, setTime] = useState(data.settings.reminderTime ?? "");
  return (
    <div className="settings-grid">
      <div className="stack">
        <section className="card">
          <SectionTitle title="Харагдах байдал" subtitle="Танд тухтай орчин." />
          <div className="theme-options">
            {(
              [
                ["system", "Систем", "sun"],
                ["light", "Гэрэлтэй", "sun"],
                ["dark", "Бараан", "moon"],
              ] as [Theme, string, string][]
            ).map(([theme, label, icon]) => (
              <button
                key={theme}
                aria-pressed={data.settings.theme === theme}
                onClick={() =>
                  run(() => store.mutate(actions.settings({ theme })))
                }
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
          </div>
          <button
            className="text-button settings-link"
            onClick={() => navigate("room")}
          >
            Өрөөний загвар, хамтрагчаа сонгох <Icon name="arrow" size={16} />
          </button>
        </section>
        <MusicSettings />
        <section className="card">
          <SectionTitle title="Timer-ийн хэмнэл" />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  store.mutate(
                    actions.settings({
                      focusMinutes: Number(focus),
                      shortBreakMinutes: Number(short),
                      longBreakMinutes: Number(long),
                    }),
                  ),
                "Timer тохиргоо хадгалагдлаа.",
              );
            }}
          >
            <label>
              Үндсэн горим
              <select
                value={data.settings.defaultTimer}
                onChange={(e) =>
                  run(() =>
                    store.mutate(
                      actions.settings({
                        defaultTimer:
                          e.target.value === "pomodoro"
                            ? "pomodoro"
                            : "stopwatch",
                      }),
                    ),
                  )
                }
              >
                <option value="stopwatch">Stopwatch</option>
                <option value="pomodoro">Pomodoro</option>
              </select>
            </label>
            <div className="form-grid three">
              <label>
                Төвлөрөх (м)
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  required
                />
              </label>
              <label>
                Богино амралт
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={short}
                  onChange={(e) => setShort(e.target.value)}
                  required
                />
              </label>
              <label>
                Урт амралт
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={long}
                  onChange={(e) => setLong(e.target.value)}
                  required
                />
              </label>
            </div>
            <button className="button">Timer тохиргоо хадгалах</button>
          </form>
          <button
            className="text-button settings-link"
            onClick={() => navigate("goals")}
          >
            Суралцах зорилгоо засах <Icon name="arrow" size={16} />
          </button>
        </section>
        <section className="card">
          <SectionTitle title="Сануулах ба offline" />
          <div className="form-stack">
            <label className="check-label">
              <input
                type="checkbox"
                checked={data.settings.sound}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  void run(async () => {
                    if (enabled) await enableSound();
                    await store.mutate(actions.settings({ sound: enabled }));
                  });
                }}
              />
              Timer дуусахад дуу гаргах
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={data.settings.notifications}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  void run(async () => {
                    if (enabled) {
                      if (typeof Notification === "undefined")
                        throw Error("Энэ браузер мэдэгдэл дэмжихгүй.");
                      const permission = await Notification.requestPermission();
                      if (permission !== "granted")
                        throw Error(
                          "Браузерын мэдэгдлийн зөвшөөрөл олгогдоогүй.",
                        );
                    }
                    await store.mutate(
                      actions.settings({ notifications: enabled }),
                    );
                  });
                }}
              />
              Мэдэгдэл авах
            </label>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    store.mutate(
                      actions.settings({ reminderTime: time || null }),
                    ),
                  "Сануулах цаг хадгалагдлаа.",
                );
              }}
            >
              <label>
                Өдөр бүр сануулах цаг
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <button className="button">Сануулах цаг хадгалах</button>
            </form>
            <p className="tiny muted">
              Сануулга апп нээлттэй үед ажиллана. Апп хаалттай үед push мэдэгдэл
              илгээх сервер тохируулаагүй. Дууг шинэ цонхонд дахин идэвхжүүлэх
              шаардлага гарч болно.
            </p>
            <InstallButton />
          </div>
        </section>
      </div>
      <div className="stack">
        <StudyPreferences />
        <button className="button" onClick={() => navigate("privacy")}>
          Нууцлал ба өгөгдлийн төв →
        </button>
        <AccountPanel />
        <DataSettings key={namespace} />
      </div>
    </div>
  );
}
export function DataSettings() {
  const { data, store, run } = useStudy(),
    { namespace } = useStoreState(),
    [incoming, setIncoming] = useState<{
      raw: string;
      data: StudyData;
      name: string;
    } | null>(null),
    [backups, setBackups] = useState<Backup[] | null>(null),
    [trash, setTrash] = useState(false),
    [busy, setBusy] = useState(false),
    [conflictId, setConflictId] = useState("");
  const [clearing, setClearing] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const unresolved = data.conflicts.filter((c) => !c.resolvedAt),
    conflict = unresolved.find((c) => c.id === conflictId),
    preview = incoming ? mergeData(data, incoming.data) : null;
  const inputFile = async (file: File | undefined) => {
    if (!file) return;
    await run(async () => {
      if (file.size > 100 * 1024 * 1024)
        throw Error("Файл 100 MB-аас их байна.");
      const raw = await file.text(),
        parsed = migrate(JSON.parse(raw));
      setIncoming({ raw, data: parsed, name: file.name });
    });
  };
  return (
    <>
      <section className="card">
        <SectionTitle
          title="Өгөгдөл ба нөөц"
          subtitle={`${data.sessions.filter((s) => !s.deletedAt).length} хичээл · ${data.subjects.filter((s) => !s.deletedAt).length} сэдэв`}
        />
        <div className="form-stack">
          <button
            className="button"
            onClick={() =>
              downloadJson(store.exportData(), `togtmol-${dateKey()}.json`)
            }
          >
            <Icon name="download" />
            JSON нөөц татах
          </button>
          <label className="button file-button">
            <Icon name="upload" />
            JSON файл нэгтгэх
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void inputFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="text-button"
            onClick={() =>
              run(async () =>
                setBackups(await store.repository.backups(namespace)),
              )
            }
          >
            Хадгалсан нөөцүүдийг харах
          </button>
          <button className="text-button" onClick={() => setTrash((v) => !v)}>
            <Icon name="trash" size={17} />
            Хогийн сав {trash ? "хаах" : "нээх"}
          </button>
          {data.quarantine.length > 0 && (
            <div className="setup-note">
              <h3>{data.quarantine.length} бичлэгийг шалгах шаардлагатай</h3>
              <p>
                Бүтэц нь танигдаагүй бичлэгүүдийг эхээр нь хадгалсан. JSON нөөц
                доторх quarantine хэсгээс авч болно.
              </p>
              <button
                className="button small"
                onClick={() =>
                  downloadJson(data.quarantine, "togtmol-recovery.json")
                }
              >
                Сэргээх бичлэгүүдийг татах
              </button>
            </div>
          )}
          {unresolved.length > 0 && (
            <div className="setup-note">
              <h3>{unresolved.length} нэгтгэлийн зөрчил</h3>
              <p>
                Хоёр өөр хувилбар хадгалагдсан. Хэрэглэх хувилбараа сонгоорой.
              </p>
              {unresolved.slice(0, 10).map((c) => (
                <button
                  className="button small"
                  key={c.id}
                  onClick={() => setConflictId(c.id)}
                >
                  {c.collection} · {c.recordId.slice(0, 20)}
                </button>
              ))}
            </div>
          )}
          <p className="tiny muted">
            Өөр браузер, домэйн эсвэл төхөөрөмж рүү шилжихээс өмнө JSON нөөцөө
            татна уу. Браузерын өгөгдлийг цэвэрлэхэд локал түүх арилна.
          </p>
          {namespace === "guest" && (
            <button
              className="text-button danger-text"
              onClick={() => setClearing(true)}
            >
              Локал түүхийг цэвэрлэх
            </button>
          )}
        </div>
      </section>
      {trash && (
        <section className="card">
          <SectionTitle
            title="Хогийн сав"
            subtitle="Сэргээх хүртэл статистикт тооцохгүй."
          />
          {(["subjects", "sessions", "tasks"] as const).map((collection) => (
            <div className="trash-group" key={collection}>
              <h3>
                {collection === "subjects"
                  ? "Хичээлүүд"
                  : collection === "sessions"
                    ? "Хэмжилтүүд"
                    : "Төлөвлөгөө"}
              </h3>
              {data[collection]
                .filter((r) => r.deletedAt)
                .slice(0, 100)
                .map((r) => (
                  <div className="trash-row" key={r.id}>
                    <span>
                      {"name" in r
                        ? r.name
                        : "title" in r
                          ? r.title
                          : `${r.date} · ${formatTime(r.durationSec)}`}
                    </span>
                    <button
                      className="text-button"
                      onClick={() =>
                        run(
                          () => store.mutate(actions.restore(collection, r.id)),
                          "Сэргээсэн.",
                        )
                      }
                    >
                      Сэргээх
                    </button>
                  </div>
                ))}
              {!data[collection].some((r) => r.deletedAt) && (
                <p className="tiny muted">Хоосон</p>
              )}
            </div>
          ))}
        </section>
      )}
      {clearing && (
        <Modal
          title="Локал түүхийг цэвэрлэх"
          onClose={() => !busy && setClearing(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (confirmation !== "ЦЭВЭРЛЭХ") return;
              setBusy(true);
              if (
                await run(
                  () => store.clearGuestData(),
                  "Локал түүхийг нөөцлөөд цэвэрлэлээ.",
                )
              ) {
                setClearing(false);
                setConfirmation("");
              }
              setBusy(false);
            }}
          >
            <p>
              Энэ төхөөрөмжийн локал хичээл, төлөвлөгөө, хугацаа, тохиргоог
              хоосолно. Эхлээд автоматаар нөөц үүсгэнэ. Бүртгэлийн үүлэн
              өгөгдөлд үйлчлэхгүй.
            </p>
            <button
              type="button"
              className="button"
              onClick={() =>
                downloadJson(
                  store.exportData(),
                  `togtmol-before-clear-${dateKey()}.json`,
                )
              }
            >
              Өөртөө JSON нөөц татах
            </button>
            <label>
              Баталгаажуулахын тулд ЦЭВЭРЛЭХ гэж бичнэ үү
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              className="button"
              disabled={busy || confirmation !== "ЦЭВЭРЛЭХ"}
            >
              Нөөцлөөд цэвэрлэх
            </button>
            <p className="tiny muted">
              Дараа нь «Хадгалсан нөөцүүдийг харах» хэсгээс сэргээж болно.
            </p>
          </form>
        </Modal>
      )}
      {incoming && preview && (
        <Modal title="Нөөц нэгтгэх" onClose={() => !busy && setIncoming(null)}>
          <div className="form-stack">
            <p className="muted">{incoming.name}</p>
            <dl className="detail-list">
              <div>
                <dt>Файл дахь хичээл</dt>
                <dd>{incoming.data.sessions.length}</dd>
              </div>
              <div>
                <dt>Нэгтгэсний дараах хичээл</dt>
                <dd>{preview.sessions.length}</dd>
              </div>
              <div>
                <dt>Шалгах бичлэг</dt>
                <dd>{incoming.data.quarantine.length}</dd>
              </div>
              <div>
                <dt>Шийдэх зөрчил</dt>
                <dd>{preview.conflicts.filter((c) => !c.resolvedAt).length}</dd>
              </div>
            </dl>
            <p className="muted">
              Одоогийн өгөгдлийг нөөцөлсний дараа нэгтгэнэ. Давхардсан ID-г
              шалгаж, зөрсөн хувилбаруудыг хадгална.
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                if (
                  await run(
                    () => store.importData(incoming.raw),
                    "Нөөцийг нэгтгэлээ.",
                  )
                )
                  setIncoming(null);
                setBusy(false);
              }}
            >
              Нөөцлөөд нэгтгэх
            </button>
          </div>
        </Modal>
      )}
      {backups && (
        <Modal title="Өмнөх нөөцүүд" onClose={() => setBackups(null)}>
          <div className="backup-list">
            {!backups.length && (
              <p className="muted">
                Шилжилт эсвэл импорт хийхэд автоматаар нөөц үүснэ.
              </p>
            )}
            {backups.map((b) => (
              <article key={b.id}>
                <h3>{b.label}</h3>
                <p>{new Date(b.createdAt).toLocaleString("mn-MN")}</p>
                <div className="button-row">
                  <button
                    className="button small"
                    onClick={() => downloadJson(b.raw, `${b.id}.json`)}
                  >
                    Татах
                  </button>
                  <button
                    className="button small"
                    onClick={() =>
                      run(async () => {
                        setIncoming({
                          raw: b.raw,
                          data: migrate(JSON.parse(b.raw)),
                          name: b.label,
                        });
                        setBackups(null);
                      })
                    }
                  >
                    Нэгтгэн сэргээх
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Modal>
      )}
      {conflict && (
        <Modal
          title="Хоёр хувилбарыг харьцуулах"
          onClose={() => setConflictId("")}
        >
          <p className="muted">
            {conflict.collection} · {conflict.recordId}
          </p>
          <div className="conflict-preview">
            <div>
              <h3>Одоогийн сонголт</h3>
              <pre>{JSON.stringify(conflict.kept, null, 2)}</pre>
            </div>
            <div>
              <h3>Нөгөө хувилбар</h3>
              <pre>{JSON.stringify(conflict.other, null, 2)}</pre>
            </div>
          </div>
          <div className="button-row">
            <button
              className="button"
              onClick={async () => {
                if (
                  await run(() =>
                    store.mutate((d) =>
                      resolveConflict(d, conflict, false, Date.now()),
                    ),
                  )
                )
                  setConflictId("");
              }}
            >
              Одоогийнхыг үлдээх
            </button>
            <button
              className="button primary"
              onClick={async () => {
                if (
                  await run(() =>
                    store.mutate((d) =>
                      migrate(resolveConflict(d, conflict, true, Date.now())),
                    ),
                  )
                )
                  setConflictId("");
              }}
            >
              Нөгөө хувилбарыг хэрэглэх
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
