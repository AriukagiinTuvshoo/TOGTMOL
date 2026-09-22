import { emptyData, LEGACY_KEY, uid } from "@/lib/constants";
import { migrate } from "@/lib/migration/migrate";
import type { StoredDocument, StudyData } from "@/types/study";
import {
  browserDatabase,
  browserStorage,
  optionalRead,
} from "./browser-storage";

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
  private knowledgeCache = new Map<
    string,
    { revision: number; records: StudyData["knowledge"] }
  >();
  constructor(
    private readonly factory: IDBFactory | undefined = browserDatabase(),
    private readonly storage: Storage | undefined = browserStorage(),
  ) {
    this.fallback = !factory;
  }
  private db(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(Error("IndexedDB боломжгүй."));
    if (!this.database)
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        let blocked = false;
        const r = this.factory!.open(DB_NAME, 3);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains("documents"))
            db.createObjectStore("documents");
          if (!db.objectStoreNames.contains("backups"))
            db.createObjectStore("backups", { keyPath: "id" });
          if (!db.objectStoreNames.contains("metadata"))
            db.createObjectStore("metadata");
          if (!db.objectStoreNames.contains("knowledge")) {
            db.createObjectStore("knowledge", {
              keyPath: ["namespace", "id"],
            }).createIndex("namespace", "namespace");
          }
          if (!db.objectStoreNames.contains("musicBlobs"))
            db.createObjectStore("musicBlobs", {
              keyPath: ["namespace", "key"],
            });
        };
        r.onsuccess = () => {
          if (blocked) {
            r.result.close();
            return;
          }
          r.result.onversionchange = () => {
            r.result.close();
            this.database = null;
          };
          resolve(r.result);
        };
        r.onerror = () => reject(r.error);
        r.onblocked = () => {
          blocked = true;
          reject(Error("Өмнөх цонхыг хаагаад дахин оролдоно уу."));
        };
      }).catch((error) => {
        this.database = null;
        throw error;
      });
    return this.database;
  }
  private local(): Storage {
    if (!this.storage) throw Error("Энэ орчинд өгөгдөл хадгалах боломжгүй.");
    return this.storage;
  }
  private async persisted(namespace: string): Promise<StoredDocument | null> {
    const db = await this.db(),
      tx = db.transaction(["documents", "knowledge"], "readonly");
    const [doc, records] = await Promise.all([
      request(tx.objectStore("documents").get(namespace)),
      request(tx.objectStore("knowledge").index("namespace").getAll(namespace)),
    ]);
    if (!doc) return null;
    return doc.knowledgeSeparated && doc.data && typeof doc.data === "object"
      ? {
          knowledgeSeparated: true,
          revision: doc.revision,
          data: {
            ...doc.data,
            knowledge: records.map((r: { record: unknown }) => r.record),
          },
        }
      : doc;
  }
  async load(namespace: string): Promise<StoredDocument | null> {
    const raw = this.fallback ? this.local().getItem(PREFIX + namespace) : null;
    let value: StoredDocument | null;
    try {
      value = this.fallback
        ? raw
          ? JSON.parse(raw)
          : null
        : await this.persisted(namespace);
    } catch (e) {
      if (raw !== null)
        await this.backup(namespace, "Уншиж чадаагүй эх өгөгдөл", raw);
      throw e;
    }
    if (value === null) return null;
    let migrated: StudyData;
    try {
      if (!value || !Number.isSafeInteger(value.revision) || value.revision < 1)
        throw Error(
          "Хадгалсан хувилбарын бүтэц буруу. Эх өгөгдлөө татаж аваад нөөцөөс сэргээнэ үү.",
        );
      migrated = migrate(value.data);
    } catch (error) {
      await this.backup(
        namespace,
        "Уншиж чадаагүй эх өгөгдөл",
        raw ?? JSON.stringify(value),
      );
      throw error;
    }
    this.knowledgeCache.set(namespace, {
      revision: value.revision,
      records: value.knowledgeSeparated ? migrated.knowledge : [],
    });
    if (Number(value.data.schemaVersion) !== 5) {
      await this.backup(
        namespace,
        `v${value.data.schemaVersion ?? 1} эх өгөгдөл — v5 шилжүүлэхийн өмнө`,
        raw ?? JSON.stringify(value),
      );
      try {
        return await this.save(namespace, migrated, value.revision);
      } catch (e) {
        if (e instanceof RevisionError) return this.load(namespace);
        throw e;
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
    let cached = this.knowledgeCache.get(namespace);
    if (!cached || cached.revision !== expectedRevision) {
      const persisted = await this.persisted(namespace);
      cached = {
        revision: persisted?.revision ?? 0,
        records: persisted?.data?.knowledge ?? [],
      };
    }
    const previous = new Map(cached.records.map((r) => [r.id, r]));
    const ids = new Set(data.knowledge.map((r) => r.id));
    const db = await this.db(),
      tx = db.transaction(["documents", "knowledge"], "readwrite"),
      finished = done(tx),
      store = tx.objectStore("documents");
    let conflict = false;
    const r = store.get(namespace);
    r.onsuccess = () => {
      if ((r.result?.revision ?? 0) !== expectedRevision) {
        conflict = true;
        tx.abort();
      } else {
        store.put(
          {
            revision: value.revision,
            knowledgeSeparated: true,
            data: { ...data, knowledge: [] },
          },
          namespace,
        );
        const records = tx.objectStore("knowledge");
        if (cached.records !== data.knowledge) {
          for (const record of data.knowledge)
            if (previous.get(record.id) !== record)
              records.put({ namespace, id: record.id, record });
          for (const id of previous.keys())
            if (!ids.has(id)) records.delete([namespace, id]);
        }
      }
    };
    try {
      await finished;
    } catch (error) {
      if (conflict) throw new RevisionError();
      throw error;
    }
    this.knowledgeCache.set(namespace, {
      revision: value.revision,
      records: data.knowledge,
    });
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
          try {
            values.push(JSON.parse(s.getItem(key)!));
          } catch {
            /* Keep malformed backup untouched; other backups remain usable. */
          }
      }
    } else {
      const db = await this.db();
      values = await request(
        db.transaction("backups", "readonly").objectStore("backups").getAll(),
      );
    }
    return values
      .filter(
        (b) =>
          b &&
          b.namespace === namespace &&
          typeof b.raw === "string" &&
          Number.isFinite(b.createdAt),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async saveMusicBlob(namespace: string, key: string, blob: Blob): Promise<void> {
    if (this.fallback)
      throw Error("Төхөөрөмжийн аудио файл хадгалахад IndexedDB шаардлагатай.");
    const db = await this.db(),
      tx = db.transaction("musicBlobs", "readwrite"),
      finished = done(tx);
    tx.objectStore("musicBlobs").put({ namespace, key, blob });
    await finished;
  }

  async loadMusicBlob(namespace: string, key: string): Promise<Blob | null> {
    if (this.fallback) return null;
    const db = await this.db();
    const value = await request(
      db
        .transaction("musicBlobs", "readonly")
        .objectStore("musicBlobs")
        .get([namespace, key]),
    );
    return value?.blob instanceof Blob ? value.blob : null;
  }

  async deleteMusicBlob(namespace: string, key: string): Promise<void> {
    if (this.fallback) return;
    const db = await this.db(),
      tx = db.transaction("musicBlobs", "readwrite"),
      finished = done(tx);
    tx.objectStore("musicBlobs").delete([namespace, key]);
    await finished;
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
  async claimOnce(key: string, value: string): Promise<boolean> {
    if (this.fallback) {
      if (typeof navigator === "undefined" || !navigator.locks) return false;
      return navigator.locks.request(PREFIX + "meta:" + key, async () => {
        if ((await this.metadata(key)) === value) return false;
        await this.setMetadata(key, value);
        return true;
      });
    }
    const db = await this.db(),
      tx = db.transaction("metadata", "readwrite"),
      finished = done(tx),
      s = tx.objectStore("metadata");
    let claimed = false;
    const r = s.get(key);
    r.onsuccess = () => {
      if (r.result !== value) {
        s.put(value, key);
        claimed = true;
      }
    };
    await finished;
    return claimed;
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
      if (raw === null) raw = optionalRead(this.storage, LEGACY_KEY);
    }
    if (namespace === "guest") {
      const pending = optionalRead(this.storage, LEGACY_KEY + ":pending:v2");
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
        (namespace === "guest" ? this.local().getItem(LEGACY_KEY) : null) ??
        "null"
      );
    const value = await this.persisted(namespace);
    if (value) return JSON.stringify(value);
    const source = (await this.backups(namespace)).find((b) =>
      b.label.startsWith("v2 эх өгөгдөл"),
    );
    return (
      source?.raw ??
      (namespace === "guest" ? optionalRead(this.storage, LEGACY_KEY) : null) ??
      "null"
    );
  }
  /** Explicit recovery only: preserve exact source, then compare it again atomically. */
  async recover(
    namespace: string,
    rawBackup: string | null,
  ): Promise<StoredDocument> {
    const before = !this.fallback ? await this.persisted(namespace) : null;
    // Capture the document and its separated records in one read transaction.
    const original = before
      ? JSON.stringify(before)
      : await this.rawDocument(namespace);
    const data =
      rawBackup === null ? emptyData() : migrate(JSON.parse(rawBackup));
    await this.backup(namespace, "Сэргээх үйлдлийн өмнөх эх өгөгдөл", original);
    if (rawBackup !== null)
      await this.backup(namespace, "Сэргээхээр сонгосон нөөц", rawBackup);
    if (namespace.startsWith("account:"))
      await this.setMetadata(`account-enabled:${namespace.slice(8)}`, false);
    if (this.fallback) {
      if (typeof navigator === "undefined" || !navigator.locks)
        throw Error("Аюулгүй сэргээхэд Web Locks шаардлагатай.");
      return navigator.locks.request(PREFIX + namespace, () => {
        const current = this.local().getItem(PREFIX + namespace);
        const legacy =
          namespace === "guest" ? this.local().getItem(LEGACY_KEY) : null;
        if ((current ?? legacy ?? "null") !== original)
          throw new RevisionError();
        let revision = 0;
        try {
          revision = JSON.parse(current ?? "null")?.revision ?? 0;
        } catch {}
        const value = {
          revision:
            Number.isSafeInteger(revision) && revision >= 0 ? revision + 1 : 1,
          data,
        };
        this.local().setItem(PREFIX + namespace, JSON.stringify(value));
        return value;
      });
    }
    const db = await this.db(),
      tx = db.transaction(["documents", "knowledge"], "readwrite"),
      finished = done(tx),
      records = tx.objectStore("documents");
    let result: StoredDocument | null = null,
      conflict = false;
    const r = records.get(namespace);
    r.onsuccess = () => {
      if ((r.result?.revision ?? null) !== (before?.revision ?? null)) {
        conflict = true;
        tx.abort();
        return;
      }
      const revision = r.result?.revision;
      result = {
        revision:
          Number.isSafeInteger(revision) && revision > 0 ? revision + 1 : 1,
        data,
      };
      // Recovery is explicit and exceptional; preserve its complete validated snapshot atomically.
      records.put(result, namespace);
      const stale = tx
        .objectStore("knowledge")
        .index("namespace")
        .openCursor(namespace);
      stale.onsuccess = () => {
        const cursor = stale.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    };
    try {
      await finished;
    } catch (e) {
      if (conflict) throw new RevisionError();
      throw e;
    }
    this.knowledgeCache.delete(namespace);
    return result!;
  }
  async close() {
    if (this.database) {
      try {
        (await this.database).close();
      } catch {}
    }
    this.database = null;
  }
}
