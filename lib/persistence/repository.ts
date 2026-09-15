import { emptyData, LEGACY_KEY, uid } from "@/lib/constants";
import { migrate } from "@/lib/migration/migrate";
import type { StoredDocument, StudyData } from "@/types/study";

export class RevisionError extends Error {
  constructor() {
    super(
      "Өөр цонхонд өгөгдөл өөрчлөгдлөө. Шинэ хувилбарыг ачаалсан тул үйлдлээ дахин хийнэ үү.",
    );
  }
}
export interface Backup {
  id: string;
  namespace: string;
  label: string;
  createdAt: number;
  raw: string;
}
type HostWindow = Window & {
  storage?: { get(key: string): Promise<{ value: string } | null> };
};
const DB_NAME = "togtmol-v3",
  PREFIX = "togtmol:v3:";
function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? Error("Хадгалалт цуцлагдлаа."));
    tx.onerror = () => reject(tx.error);
  });
}
export class Repository {
  private database: Promise<IDBDatabase> | null = null;
  readonly fallback: boolean;
  constructor(
    private readonly factory: IDBFactory | undefined = globalThis.indexedDB,
    private readonly storage: Storage | undefined = typeof window !==
    "undefined"
      ? window.localStorage
      : undefined,
  ) {
    this.fallback = !factory;
  }
  private db(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(Error("IndexedDB боломжгүй."));
    if (!this.database)
      this.database = new Promise((resolve, reject) => {
        const r = this.factory!.open(DB_NAME, 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          db.createObjectStore("documents");
          db.createObjectStore("backups", { keyPath: "id" });
          db.createObjectStore("metadata");
        };
        r.onsuccess = () => {
          r.result.onversionchange = () => r.result.close();
          resolve(r.result);
        };
        r.onerror = () => reject(r.error);
        r.onblocked = () =>
          reject(Error("Өмнөх цонхыг хаагаад дахин оролдоно уу."));
      });
    return this.database;
  }
  private local(): Storage {
    if (!this.storage) throw Error("Энэ орчинд өгөгдөл хадгалах боломжгүй.");
    return this.storage;
  }
  async load(namespace: string): Promise<StoredDocument | null> {
    let value: StoredDocument | undefined;
    let serialized: string | null = null;
    if (this.fallback) {
      const raw = this.local().getItem(PREFIX + namespace);
      serialized = raw;
      value = raw ? JSON.parse(raw) : undefined;
    } else {
      const db = await this.db();
      value = await request(
        db
          .transaction("documents", "readonly")
          .objectStore("documents")
          .get(namespace),
      );
    }
    if (!value) return null;
    if (!Number.isSafeInteger(value.revision) || value.revision < 1)
      throw Error("Хадгалсан хувилбарын бүтэц буруу. Нөөцөө татаж авна уу.");
    const migrated = migrate(value.data);
    if (Number(value.data.schemaVersion) !== 4) {
      // Back up the complete persisted document BEFORE the first v4 write.
      await this.backup(
        namespace,
        "v3 эх өгөгдөл — v4 шилжүүлэхийн өмнө",
        serialized ?? JSON.stringify(value),
      );
      try {
        return await this.save(namespace, migrated, value.revision);
      } catch (error) {
        if (error instanceof RevisionError) return this.load(namespace);
        throw error;
      }
    }
    return { revision: value.revision, data: migrated };
  }
  async save(
    namespace: string,
    data: StudyData,
    expectedRevision: number,
  ): Promise<StoredDocument> {
    const value = { revision: expectedRevision + 1, data };
    if (this.fallback) {
      // Web Locks serialize the fallback across tabs where supported. IDB remains the primary store.
      const write = () => {
        const raw = this.local().getItem(PREFIX + namespace);
        const old = raw ? JSON.parse(raw) : null;
        if ((old?.revision ?? 0) !== expectedRevision)
          throw new RevisionError();
        this.local().setItem(PREFIX + namespace, JSON.stringify(value));
        return value;
      };
      if (typeof navigator !== "undefined" && navigator.locks)
        return navigator.locks.request(PREFIX + namespace, write);
      throw Error(
        "Аюулгүй хадгалалтад IndexedDB эсвэл Web Locks хэрэгтэй. Өөр браузер ашиглана уу.",
      );
    }
    const db = await this.db(),
      tx = db.transaction("documents", "readwrite"),
      finished = done(tx),
      store = tx.objectStore("documents");
    let conflict = false;
    const r = store.get(namespace);
    r.onsuccess = () => {
      if ((r.result?.revision ?? 0) !== expectedRevision) {
        conflict = true;
        tx.abort();
      } else store.put(value, namespace);
    };
    try {
      await finished;
    } catch (error) {
      if (conflict) throw new RevisionError();
      throw error;
    }
    return value;
  }
  async backup(namespace: string, label: string, raw: string): Promise<Backup> {
    const backup = {
      id: uid("backup"),
      namespace,
      label,
      raw,
      createdAt: Date.now(),
    };
    if (this.fallback)
      this.local().setItem(PREFIX + backup.id, JSON.stringify(backup));
    else {
      const db = await this.db(),
        tx = db.transaction("backups", "readwrite"),
        finished = done(tx);
      tx.objectStore("backups").put(backup);
      await finished;
    }
    return backup;
  }
  async backups(namespace: string): Promise<Backup[]> {
    let values: Backup[] = [];
    if (this.fallback) {
      const s = this.local();
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i);
        if (key?.startsWith(PREFIX + "backup_"))
          values.push(JSON.parse(s.getItem(key)!));
      }
    } else {
      const db = await this.db();
      values = await request(
        db.transaction("backups", "readonly").objectStore("backups").getAll(),
      );
    }
    return values
      .filter((b) => b.namespace === namespace)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async metadata<T>(key: string): Promise<T | null> {
    if (this.fallback) {
      const raw = this.local().getItem(PREFIX + "meta:" + key);
      return raw ? JSON.parse(raw) : null;
    }
    const db = await this.db();
    return (
      (await request(
        db.transaction("metadata", "readonly").objectStore("metadata").get(key),
      )) ?? null
    );
  }
  async setMetadata(key: string, value: unknown): Promise<void> {
    if (this.fallback) {
      this.local().setItem(PREFIX + "meta:" + key, JSON.stringify(value));
      return;
    }
    const db = await this.db(),
      tx = db.transaction("metadata", "readwrite"),
      finished = done(tx);
    tx.objectStore("metadata").put(value, key);
    await finished;
  }
  async initialize(namespace: string): Promise<StoredDocument> {
    const existing = await this.load(namespace);
    if (existing) return existing;
    let raw: string | null = null;
    if (namespace === "guest") {
      if (typeof window !== "undefined" && (window as HostWindow).storage)
        raw =
          (await (window as HostWindow).storage!.get(LEGACY_KEY))?.value ??
          null;
      if (raw === null) raw = this.local().getItem(LEGACY_KEY);
    }
    if (namespace === "guest") {
      const pending = this.storage?.getItem(LEGACY_KEY + ":pending:v2");
      if (pending) {
        await this.backup(namespace, "v2 хадгалалтын сэргээх journal", pending);
        try {
          const value = JSON.parse(pending);
          if (
            typeof value.payload === "string" &&
            (value.base === raw || value.payload === raw)
          ) {
            if (raw !== null)
              await this.backup(
                namespace,
                "v2 journal сэргээхийн өмнөх эх",
                raw,
              );
            raw = value.payload;
          } else if (typeof value.payload === "string")
            await this.backup(
              namespace,
              "v2 зөрсөн хадгалалтын өгөгдөл",
              value.payload,
            );
        } catch {
          /* Exact pending source is already backed up. */
        }
      }
    }
    let data = emptyData();
    if (raw !== null) {
      await this.backup(namespace, "v2 эх өгөгдөл — шилжүүлэхийн өмнө", raw);
      data = migrate(JSON.parse(raw));
    }
    // A broken source never becomes an empty successful migration.
    try {
      return await this.save(namespace, data, 0);
    } catch (error) {
      if (error instanceof RevisionError) {
        const current = await this.load(namespace);
        if (current) return current;
      }
      throw error;
    }
  }
  async rawDocument(namespace: string): Promise<string> {
    if (this.fallback)
      return (
        this.local().getItem(PREFIX + namespace) ??
        this.local().getItem(LEGACY_KEY) ??
        "null"
      );
    const db = await this.db(),
      value = await request(
        db
          .transaction("documents", "readonly")
          .objectStore("documents")
          .get(namespace),
      );
    if (value) return JSON.stringify(value);
    const source = (await this.backups(namespace)).find((b) =>
      b.label.startsWith("v2 эх өгөгдөл"),
    );
    return source?.raw ?? this.storage?.getItem(LEGACY_KEY) ?? "null";
  }
  async close() {
    if (this.database) (await this.database).close();
    this.database = null;
  }
}
