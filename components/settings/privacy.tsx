"use client";
import { useEffect, useState } from "react";
import { useStudy, useStoreState } from "@/hooks/use-study";
import { useAccount } from "@/hooks/use-account";
import { Modal, downloadJson, SectionTitle } from "@/components/ui/common";
import { DataSettings } from "./settings";
export function PrivacyCenter() {
  const { data, store, run, navigate } = useStudy(),
    { namespace, busy } = useStoreState(),
    account = useAccount();
  const [backup, setBackup] = useState<number | null>(null),
    [synced, setSynced] = useState<number | null>(null),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [working, setWorking] = useState(false);
  const [localReset, setLocalReset] = useState(false),
    [localConfirmation, setLocalConfirmation] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      store.repository.backups(namespace),
      account.user
        ? store.repository.metadata<number>(`last-sync:${account.user.id}`)
        : Promise.resolve(null),
    ])
      .then(([backups, sync]) => {
        if (active) {
          setBackup(backups[0]?.createdAt ?? null);
          setSynced(sync);
        }
      })
      .catch(store.reportError);
    return () => {
      active = false;
    };
  }, [store, namespace, account.user]);
  const ai = data.settings.extras.aiEnabled === true;
  return (
    <div className="privacy-page">
      <section className="privacy-overview">
        <div className="privacy-header card">
          <div>
            <span className="eyebrow">PRIVACY · DATA</span>
            <h1>Таны өгөгдөл. Таны хяналт.</h1>
            <p>
              Өгөгдөл хаана хадгалагдаж байгаа, юу синк хийгдэж байгаа болон
              нөөцөө хэрхэн удирдахыг нэг дороос харна.
            </p>
          </div>
          <div className="privacy-status-orb" aria-hidden="true">
            <span>LOCKED</span>
            <strong>∞</strong>
            <small>Өөрийн өгөгдөл</small>
          </div>
        </div>
        <section className="card privacy-status-card">
          <div className="privacy-section-head">
            <div>
              <span className="eyebrow">DATA STATUS</span>
              <h2>Одоогийн хадгалалтын төлөв</h2>
            </div>
            <span className={account.syncEnabled ? "privacy-chip on" : "privacy-chip"}>{account.syncEnabled ? "СИНК АСААЛТТАЙ" : "ЛОКАЛ ГОРИМ"}</span>
          </div>
          <dl className="detail-list privacy-details">
          <div>
            <dt>Энд хадгалагдаж буй зүйл</dt>
            <dd>
              {data.sessions.filter((s) => !s.deletedAt).length} хэмжилт ·{" "}
              {data.knowledge.filter((r) => !r.deletedAt).length} мэдлэгийн
              бичлэг · зорилго, төлөвлөгөө, тохиргоо
            </dd>
          </div>
          <div>
            <dt>Үндсэн хадгалалт</dt>
            <dd>
              {store.repository.fallback
                ? "Энэ браузерын жижиг хадгалалт"
                : "Энэ төхөөрөмжийн IndexedDB өгөгдлийн сан"}
            </dd>
          </div>
          <div>
            <dt>Үүлэн синк</dt>
            <dd>
              {account.syncEnabled
                ? "Асаалттай · хувийн бүртгэл"
                : "Унтраалттай"}
            </dd>
          </div>
          <div>
            <dt>Онлайн Бондоокийн зөвшөөрөл</dt>
            <dd>{ai ? "Асаасан" : "Өгөгдөөгүй"}</dd>
          </div>
          <div>
            <dt>Сүүлд синк хийсэн</dt>
            <dd>
              {synced ? new Date(synced).toLocaleString("mn-MN") : "Хийгээгүй"}
            </dd>
          </div>
          <div>
            <dt>Сүүлийн нөөц</dt>
            <dd>
              {backup
                ? new Date(backup).toLocaleString("mn-MN")
                : "Одоогоор үүсээгүй"}
            </dd>
          </div>
        </dl>
        <div className="button-row privacy-actions">
          <button
            className="button primary"
            disabled={busy || working}
            onClick={() =>
              void run(async () => {
                const snapshot = store.exportData();
                const b = await store.repository.backup(
                  namespace,
                  "Өөрийн үүсгэсэн бүрэн нөөц",
                  JSON.stringify(snapshot),
                );
                downloadJson(
                  snapshot,
                  `togtmol-v5-${new Date().toISOString().slice(0, 10)}.json`,
                );
                setBackup(b.createdAt);
                await store.repository.setMetadata(
                  `last-export:${namespace}`,
                  b.createdAt,
                );
              }, "Бүрэн нөөц үүсгэлээ.")
            }
          >
            <Icon name="download" size={17} />
            Бүрэн нөөц татах
          </button>
        </div>
        <p className="tiny muted">
          Нөөц файл нь энэ төхөөрөмж дээрх одоогийн өгөгдлийг бүхэлд нь JSON
          хэлбэрээр хадгална. Бусад төхөөрөмж рүү шилжихдээ энэ файлыг ашиглаж
          болно.
        </p>
        {!account.user && (
          <button className="text-button" onClick={() => navigate("settings")}>
            Бүртгэл, холболтын тохиргоо →
          </button>
        )}
      </section>
      </section>
      <section className="card privacy-action-card">
        <div className="privacy-section-head">
          <div>
            <span className="eyebrow">CONTROL CENTER</span>
            <h2>Зөвшөөрөл ба нөөц</h2>
            <p>Онлайн үйлчилгээ болон локал өгөгдлөө тусад нь удирдана.</p>
          </div>
        </div>
        <div className="privacy-action-grid">
          <article>
            <span className="privacy-action-icon">◈</span>
            <div>
              <strong>AI боловсруулалт</strong>
              <p>{ai ? "Онлайн Бондоок ашиглах зөвшөөрөл асаалттай." : "Онлайн Бондоокт зөвшөөрөл өгөөгүй."}</p>
            </div>
            <button className="button small" disabled={!ai || busy} onClick={() => void run(() => store.mutate((d) => ({
              ...d,
              settings: {
                ...d.settings,
                updatedAt: Date.now(),
                extras: { ...d.settings.extras, aiEnabled: false, aiIncludeNotes: false },
              },
            })), "Онлайн Бондоокийн зөвшөөрлийг унтраалаа.")}>
              {ai ? "Унтраах" : "Унтраалттай"}
            </button>
          </article>
          <article>
            <span className="privacy-action-icon">☁</span>
            <div>
              <strong>Үүлэн синк</strong>
              <p>{account.syncEnabled ? "Энэ бүртгэлтэй автоматаар синк хийнэ." : "Энэ төхөөрөмж локал өгөгдөл ашиглаж байна."}</p>
            </div>
            {account.syncEnabled ? (
              <button className="button small" disabled={busy || working} onClick={() => void run(account.disableSync, "Үүлэн синк унтраалаа.")}>Унтраах</button>
            ) : (
              <button className="button small" disabled={!account.user || busy || working} onClick={() => void run(() => account.connect(false))}>Асаах</button>
            )}
          </article>
          <article>
            <span className="privacy-action-icon">↥</span>
            <div>
              <strong>Автомат нөөцийн сануулга</strong>
              <p>{data.settings.extras.backupReminder === true ? "14 хоног тутам нөөц сануулна." : "Нөөцийн сануулга унтраалттай."}</p>
            </div>
            <label className="switch-control">
              <input
                type="checkbox"
                checked={data.settings.extras.backupReminder === true}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  void run(() => store.mutate((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      updatedAt: Date.now(),
                      extras: { ...d.settings.extras, backupReminder: enabled },
                    },
                  })));
                }}
              />
              <span aria-hidden="true" />
            </label>
          </article>
        </div>
      </section>
      <DataSettings />
      {namespace.startsWith("account:") && (
        <section className="card danger-zone">
          <div className="privacy-section-head">
            <div>
              <span className="eyebrow">THIS DEVICE</span>
              <h2>Энэ төхөөрөмжийн локал өгөгдөл</h2>
              <p>
                Энэ төхөөрөмж дээр хадгалагдсан хуулбарыг цэвэрлэнэ. Үүлэн
                түүх болон бусад бүртгэл устахгүй.
              </p>
            </div>
            <span className="privacy-chip danger">АНХААР</span>
          </div>
          <button
            className="button danger-text"
            disabled={working || busy}
            onClick={() => setLocalReset(true)}
          >
            Локал хуулбарыг цэвэрлэх
          </button>
        </section>
      )}
      {localReset && (
        <Modal
          title="Локал хуулбарыг цэвэрлэх"
          onClose={() => {
            if (!working) setLocalReset(false);
          }}
        >
          <div className="form-stack">
            <label>
              Баталгаажуулахын тулд ЦЭВЭРЛЭХ гэж бичнэ үү
              <input
                value={localConfirmation}
                onChange={(e) => setLocalConfirmation(e.target.value)}
              />
            </label>
            <button
              className="button"
              disabled={working || localConfirmation !== "ЦЭВЭРЛЭХ"}
              onClick={async () => {
                setWorking(true);
                if (
                  await run(async () => {
                    await account.disableSync();
                    await store.clearLocalData();
                  }, "Локал хуулбарыг цэвэрлэж, нөөцийг үлдээлээ.")
                )
                  setLocalReset(false);
                setWorking(false);
              }}
            >
              Нөөцөлж цэвэрлэх
            </button>
          </div>
        </Modal>
      )}
      <section className="card danger-zone">
        <div className="privacy-section-head">
          <div>
            <span className="eyebrow">REMOTE DATA</span>
            <h2>Үүлэн суралцах түүхийг цэвэрлэх</h2>
            <p>Зөвхөн энэ бүртгэлийн үүлэнд хадгалсан суралцах түүхэд үйлчилнэ.</p>
          </div>
          <span className="privacy-chip danger">УСТГАЛТ</span>
        </div>
        <p>
          Хичээл, хэмжилт, тэмдэглэл, зураг, карт, сорил, зорилго болон үүлэн
          тохиргоо устна. Бүртгэл өөрөө устахгүй. Нөөц үүсгэх боломжгүй бол
          устгал эхлэхгүй.
        </p>
        <button
          className="button danger-text"
          disabled={
            !account.user ||
            namespace !== `account:${account.user?.id}` ||
            working
          }
          onClick={() => setDeleting(true)}
        >
          Үүлэн түүхийг цэвэрлэх
        </button>
      </section>
      {deleting && (
        <Modal
          title="Үүлэн түүхийг цэвэрлэх"
          onClose={() => {
            if (!working) setDeleting(false);
          }}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirmation !== "ҮҮЛНЭЭС УСТГАХ") return;
              setWorking(true);
              void run(
                account.deleteCloud,
                "Үүлэн түүхийг нөөцлөөд цэвэрлэлээ.",
              ).then((ok) => {
                setWorking(false);
                if (ok) {
                  setDeleting(false);
                  setConfirmation("");
                }
              });
            }}
          >
            <p>
              Хичээл, хэмжилт, тэмдэглэл, зураг, карт, сорил, зорилго болон
              үүлэнд хадгалсан тохиргоо устна. Нөөц үүсгэж чадахгүй бол
              устгахгүй.
            </p>
            <label>
              ҮҮЛНЭЭС УСТГАХ гэж бичнэ үү
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <button
              className="button"
              disabled={working || confirmation !== "ҮҮЛНЭЭС УСТГАХ"}
            >
              {working ? "Нөөцөлж, цэвэрлэж байна…" : "Нөөцлөөд үүлнээс устгах"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
