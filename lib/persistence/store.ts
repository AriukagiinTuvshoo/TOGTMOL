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
      const document = await this.repository.initialize(namespace);
      this.publish({ ...document, namespace, ready: true, error: null });
    });
  }
  reload(): Promise<void> {
    return this.serialize(async () => {
      const doc = await this.repository.load(this.state.namespace);
      if (doc && doc.revision > this.state.revision) this.publish({ ...doc });
    });
  }
  mutate(transform: (data: StudyData) => StudyData): Promise<void> {
    return this.serialize(async () => {
      if (!this.state.ready) throw Error("Өгөгдөл ачаалж дуусаагүй байна.");
      this.publish({ busy: true });
      try {
        const old = this.state.data;
        let next = transform(old);
        if (next === old) return;
        if (
          next.sessions !== old.sessions ||
          next.entries !== old.entries ||
          next.goals !== old.goals
        )
          next = unlock(next, buildIndex(next));
        const document = await this.repository.save(
          this.state.namespace,
          next,
          this.state.revision,
        );
        this.publish({ ...document, error: null });
        this.channel?.postMessage(this.state.namespace);
      } catch (error) {
        if (error instanceof RevisionError) {
          const doc = await this.repository.load(this.state.namespace);
          if (doc) this.publish({ ...doc });
        }
        this.reportError(error);
        throw error;
      } finally {
        this.publish({ busy: false });
      }
    });
  }
  async importData(raw: string, label = "Импортын өмнөх нөөц") {
    const imported = migrate(JSON.parse(raw));
    await this.repository.backup(
      this.state.namespace,
      "Импортолсон эх файл",
      raw,
    );
    await this.repository.backup(
      this.state.namespace,
      label,
      JSON.stringify(this.exportData()),
    );
    await this.mutate((current) =>
      mergeData(current, snapshotForExport(imported, Date.now())),
    );
  }
  exportData() {
    return {
      format: "togtmol-backup",
      version: 4,
      exportedAt: new Date().toISOString(),
      data: snapshotForExport(
        {
          ...this.state.data,
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
