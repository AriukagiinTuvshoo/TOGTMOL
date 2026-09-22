"use client";
import { useState } from "react";
import { Repository, type Backup } from "@/lib/persistence/repository";
import { migrate } from "@/lib/migration/migrate";
import { downloadJson } from "@/components/ui/common";
export function RecoveryPanel({
  repository: provided,
  namespace = "guest",
  onRecovered,
}: {
  repository?: Repository;
  namespace?: string;
  onRecovered: () => void | Promise<void>;
}) {
  const [repository] = useState(() => provided ?? new Repository());
  const [backups, setBackups] = useState<Backup[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const act = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сэргээж чадсангүй.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card recovery-panel">
      <span className="eyebrow">ӨГӨГДӨЛ СЭРГЭЭХ</span>
      <h2>Өмнөх алхмуудаа хамгаалъя</h2>
      <p>
        Өгөгдлийг автоматаар устгахгүй. Эхлээд эх файлаа татаж аваад, дараа нь
        сэргээх хувилбараа сонгоорой.
      </p>
      <div className="button-row">
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              await onRecovered();
            })
          }
        >
          Дахин оролдох
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void act(async () =>
              downloadJson(
                await repository.rawDocument(namespace),
                "togtmol-raw-recovery.json",
              ),
            )
          }
        >
          Эх өгөгдлөө татах
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void act(async () =>
              setBackups(await repository.backups(namespace)),
            )
          }
        >
          Нөөцөөс сэргээх
        </button>
      </div>
      {backups && (
        <div className="backup-list">
          {!backups.length && (
            <p>
              Хадгалсан нөөц олдсонгүй. Өмнө татсан JSON файлаар сэргээж болно.
            </p>
          )}
          {backups.slice(0, 30).map((b) => {
            let valid = true;
            try {
              migrate(JSON.parse(b.raw));
            } catch {
              valid = false;
            }
            return (
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
                    disabled={busy || !valid}
                    onClick={() =>
                      void act(async () => {
                        if (
                          !confirm(
                            "Одоогийн эх өгөгдлийг нөөцлөөд, энэ хувилбарыг сэргээх үү?",
                          )
                        )
                          return;
                        await repository.recover(namespace, b.raw);
                        await onRecovered();
                      })
                    }
                  >
                    {valid
                      ? "Энэ нөөцийг сэргээх"
                      : "Бүтцийг шалгах шаардлагатай"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <label className="button file-button">
        JSON нөөцөөр сэргээх
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              void act(async () => {
                if (file.size > 100 * 1024 * 1024)
                  throw Error("Нөөц 100 MB-аас их байна.");
                const raw = await file.text();
                migrate(JSON.parse(raw));
                if (
                  !confirm("Эх өгөгдлийг нөөцлөөд, сонгосон файлыг сэргээх үү?")
                )
                  return;
                await repository.recover(namespace, raw);
                await onRecovered();
              });
          }}
        />
      </label>
      <button
        className="text-button danger-text"
        disabled={busy}
        onClick={() => setReset(!reset)}
      >
        Локал аппыг шинээр эхлүүлэх
      </button>
      {reset && (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmation === "ЦЭВЭРЛЭХ")
              void act(async () => {
                await repository.recover(namespace, null);
                await onRecovered();
              });
          }}
        >
          <p>
            Одоогийн эхийг нөөцөлсний дараа энэ төхөөрөмжийн сонгосон
            хадгалалтыг хоосолно. Нөөц үүсэхгүй бол цэвэрлэхгүй.
          </p>
          <label>
            ЦЭВЭРЛЭХ гэж бичнэ үү
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={busy || confirmation !== "ЦЭВЭРЛЭХ"}
          >
            Нөөцлөөд шинээр эхлүүлэх
          </button>
        </form>
      )}
      {busy && <p role="status">Өгөгдөл шалгаж байна…</p>}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
