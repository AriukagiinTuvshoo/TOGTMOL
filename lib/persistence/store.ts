import { readMusicPreference } from "@/lib/music/preferences";
import { dayBoundary } from "@/lib/preferences";
import { studyDate } from "@/lib/calculations/dates";
import { readTimerDraft } from "./timer-draft";
import { emptyData } from "@/lib/constants";
import { buildIndex } from "@/lib/calculations/analytics";
import { unlock } from "@/lib/calculations/achievements";
import { migrate } from "@/lib/migration/migrate";
import { mergeData } from "@/lib/migration/merge";
import { snapshotForExport } from "@/lib/calculations/timer";
import { Repository, RevisionError } from "./repository";
import type { StudyData } from "@/types/study";
export interface StoreState {
  data: StudyData;
  revision: number;
  namespace: string;
  ready: boolean;
  error: string | null;
  busy: boolean;
}
export const initialState: StoreState = {
  data: emptyData(),
  revision: 0,
  namespace: "guest",
  ready: false,
  error: null,
  busy: false,
};
export class StudyStore {
  private state: StoreState = initialState;
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private channel: BroadcastChannel | null = null;
  private initializing: Promise<void> | null = null;
  private backupDays = new Map<string, string>();
  constructor(readonly repository = new Repository()) {}
  getSnapshot = () => this.state;
  getServerSnapshot = () => initialState;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  clearError = () => this.publish({ error: null });
  reportError = (error: unknown) =>
    this.publish({
      error: error instanceof Error ? error.message : String(error),
    });
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
  initialize(): Promise<void> {
    if (this.initializing) return this.initializing;
    this.initializing = this.start().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }
  private async start() {
    try {
      await this.switchNamespace("guest");
      if (!this.channel && typeof BroadcastChannel !== "undefined") {
        this.channel = new BroadcastChannel("togtmol-v3");
        this.channel.onmessage = (e) => {
          if (e.data === this.state.namespace)
            void this.reload().catch(this.reportError);
        };
      }
    } catch (error) {
      this.reportError(error);
    }
  }
  switchNamespace(namespace: string, retainActive = false): Promise<void> {
    return this.serialize(async () => {
      if (
        !retainActive &&
        this.state.data.activeTimer &&
        this.state.namespace !== namespace
      )
        throw Error(
          "Одоогийн timer-аа хадгалж эсвэл цуцалсны дараа горимоо солино уу.",
        );
      try {
        const document = await this.repository.initialize(namespace);
        this.publish({ ...document, namespace, ready: true, error: null });
      } catch (error) {
        // Recovery must target the failed account, never display another account's data.
        this.publish({
          data: emptyData(),
          revision: 0,
          namespace,
          ready: false,
        });
        this.reportError(error);
        throw error;
      }
    });
  }
  reload(): Promise<void> {
    return this.serialize(async () => {
      const doc = await this.repository.load(this.state.namespace);
      if (doc && doc.revision > this.state.revision) this.publish({ ...doc });
    });
  }
  mutate(
    transform: (data: StudyData) => StudyData,
    options: { reportError?: boolean; reportBusy?: boolean } = {},
  ): Promise<void> {
    return this.serialize(async () => {
      if (!this.state.ready) throw Error("Өгөгдөл ачаалж дуусаагүй байна.");
      if (options.reportBusy !== false) this.publish({ busy: true });
      try {
        const old = this.state.data;
        let next = transform(old);
        if (next === old) return;
        if (
          next.sessions !== old.sessions ||
          next.entries !== old.entries ||
          next.goals !== old.goals ||
          next.knowledge !== old.knowledge ||
          next.studyGoals !== old.studyGoals
        )
          next = unlock(next, buildIndex(next));
        await this.backupDaily();
        const document = await this.repository.save(
          this.state.namespace,
          next,
          this.state.revision,
        );
        this.publish({
          ...document,
          ...(options.reportError !== false ? { error: null } : {}),
        });
        this.channel?.postMessage(this.state.namespace);
      } catch (error) {
        if (error instanceof RevisionError) {
          const doc = await this.repository.load(this.state.namespace);
          if (doc) this.publish({ ...doc });
        }
        if (options.reportError !== false) this.reportError(error);
        throw error;
      } finally {
        if (options.reportBusy !== false) this.publish({ busy: false });
      }
    });
  }
  private async backupDaily() {
    const namespace = this.state.namespace,
      day = studyDate(new Date(), dayBoundary(this.state.data.settings));
    if (this.backupDays.get(namespace) === day) return;
    const key = `auto-backup:${namespace}`;
    if ((await this.repository.metadata<string>(key)) !== day) {
      await this.repository.backup(
        namespace,
        "Өдрийн автомат нөөц",
        JSON.stringify(this.exportData()),
      );
      await this.repository.setMetadata(key, day);
    }
    this.backupDays.set(namespace, day);
  }
  async importData(raw: string, label = "Импортын өмнөх нөөц") {
    const namespace = this.state.namespace,
      before = JSON.stringify(this.exportData());
    const imported = migrate(JSON.parse(raw));
    await this.repository.backup(namespace, "Импортолсон эх файл", raw);
    await this.repository.backup(namespace, label, before);
    await this.mutate((current) => {
      if (this.state.namespace !== namespace)
        throw Error("Бүртгэл өөрчлөгдсөн тул импортыг зогсоолоо.");
      return mergeData(current, snapshotForExport(imported, Date.now()));
    });
  }
  clearGuestData(): Promise<void> {
    return this.clearLocalData(true);
  }
  clearLocalData(guestOnly = false): Promise<void> {
    return this.serialize(async () => {
      const namespace = this.state.namespace;
      if (!this.state.ready || (guestOnly && namespace !== "guest"))
        throw Error("Эхлээд төхөөрөмжийн локал горимд шилжинэ үү.");
      if (
        namespace.startsWith("account:") &&
        (await this.repository.metadata(
          `account-enabled:${namespace.slice(8)}`,
        )) === true
      )
        throw Error("Үүлэн синкийг эхлээд унтраана уу.");
      if (this.state.data.activeTimer)
        throw Error("Ажиллаж буй цагийг эхлээд хадгалж эсвэл цуцална уу.");
      this.publish({ busy: true });
      try {
        // Complete the durable backup before replacing any study records.
        await this.repository.backup(
          namespace,
          "Локал түүхийг цэвэрлэхийн өмнөх нөөц",
          JSON.stringify(this.exportData()),
        );
        const document = await this.repository.save(
          namespace,
          emptyData(),
          this.state.revision,
        );
        await this.repository.clearMusicBlobs(namespace);
        this.publish({ ...document, error: null });
        this.channel?.postMessage(namespace);
      } catch (error) {
        if (error instanceof RevisionError) {
          const document = await this.repository.load(namespace);
          if (document) this.publish({ ...document });
        }
        this.reportError(error);
        throw error;
      } finally {
        this.publish({ busy: false });
      }
    });
  }
  exportData() {
    return {
      format: "togtmol-backup",
      app: "togtmol",
      version: 5,
      exportedAt: new Date().toISOString(),
      data: snapshotForExport(
        {
          ...this.state.data,
          settings: {
            ...this.state.data.settings,
            extras: {
              ...this.state.data.settings.extras,
              musicPreferences:
                this.state.data.settings.extras.musicPreferences ??
                readMusicPreference(this.state.namespace),
            },
          },
          activeTimer: this.state.data.activeTimer
            ? {
                ...this.state.data.activeTimer,
                note: readTimerDraft(
                  this.state.namespace,
                  this.state.data.activeTimer.id,
                  this.state.data.activeTimer.note,
                ),
              }
            : null,
        },
        Date.now(),
      ),
    };
  }
  destroy() {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
    void this.repository.close();
  }
}
