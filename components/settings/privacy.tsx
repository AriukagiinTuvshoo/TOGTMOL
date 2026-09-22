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
      <section className="card">
        <span className="eyebrow">ХУВИЙН ОРОН ЗАЙ</span>
        <h2>Таны мэдлэг. Таны мэдэлд.</h2>
        <p>
          Нийтийн профайл үүсгэхгүй. Үүлэн хадгалалт болон онлайн Бондоокийг та
          өөрөө асаана.
        </p>
        <dl className="detail-list">
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
        <div className="button-row">
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
            Бүх өгөгдлөө татах
          </button>
          <button
            className="button"
            disabled={!ai || busy}
            onClick={() =>
              void run(
                () =>
                  store.mutate((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      updatedAt: Date.now(),
                      extras: {
                        ...d.settings.extras,
                        aiEnabled: false,
                        aiIncludeNotes: false,
                      },
                    },
                  })),
                "Онлайн Бондоокийн зөвшөөрлийг унтраалаа.",
              )
            }
          >
            AI боловсруулалтыг унтраах
          </button>
          <button
            className="button"
            disabled={!account.syncEnabled || working}
            onClick={() =>
              void run(account.disableSync, "Үүлэн синк унтраалаа.")
            }
          >
            Үүлэн синк унтраах
          </button>
          <button
            className="button"
            disabled={account.syncEnabled || !account.user || working}
            onClick={() => void run(() => account.connect(false))}
          >
            Үүлэн синк асаах
          </button>
        </div>
        <p className="tiny muted">
          Онлайн Бондоокт асуултад шаардлагатай товч мэдээлэл л очно. Тэмдэглэл,
          зургийг тусдаа зөвшөөрлөөр илгээнэ. Унтраах нь өмнө илгээсэн
          мэдээллийг үйлчилгээ үзүүлэгчээс буцаан татах үйлдэл биш.
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={data.settings.extras.backupReminder === true}
            onChange={(e) => {
              const enabled = e.target.checked;
              void run(() =>
                store.mutate((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    updatedAt: Date.now(),
                    extras: { ...d.settings.extras, backupReminder: enabled },
                  },
                })),
              );
            }}
          />
          14 хоног нөөц татаагүй бол сануулах
        </label>
        {!account.user && (
          <button className="text-button" onClick={() => navigate("settings")}>
            Бүртгэл, холболтын тохиргоо →
          </button>
        )}
      </section>
      <DataSettings />
      {namespace.startsWith("account:") && (
        <section className="card">
          <h2>Энэ төхөөрөмжийн бүртгэлийн түүх</h2>
          <p>
            Үүлэн синкийг унтрааж, локал эх өгөгдлийн нөөц үүсгэсний дараа энэ
            төхөөрөмжийн үндсэн хуулбарыг цэвэрлэнэ. Үүлэн түүх, бусад бүртгэл
            болон сэргээх нөөцүүд үлдэнэ.
          </p>
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
      <section className="card">
        <SectionTitle title="Үүлэн өгөгдлийг цэвэрлэх" />
        <p>
          Зөвхөн нэвтэрсэн бүртгэлийн суралцах түүхийг үүлнээс устгана. Өмнө нь
          энэ төхөөрөмжид нөөц үүсгэж, синкийг зогсооно. Бүртгэл болон
          төхөөрөмжийн түүх үлдэнэ.
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
