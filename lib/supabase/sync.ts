import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyData } from "@/types/study";
import { StudyStore } from "@/lib/persistence/store";
import { mergeData } from "@/lib/migration/merge";
import { migrate } from "@/lib/migration/migrate";
import { stable } from "@/lib/migration/values";
export interface CloudSnapshot {
  revision: number;
  data: StudyData;
}
export interface CloudAdapter {
  pull(userId: string): Promise<CloudSnapshot>;
  push(userId: string, revision: number, data: StudyData): Promise<number>;
}
export class SupabaseAdapter implements CloudAdapter {
  constructor(private client: SupabaseClient) {}
  async pull(userId: string) {
    const { data, error } = await this.client.rpc("pull_study_data", {
      expected_user_id: userId,
    });
    if (error) throw Error(`Cloud унших: ${error.message}`);
    if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0)
      throw Error("Cloud хариу буруу байна.");
    return { revision: data.revision, data: migrate(data.data) };
  }
  async push(userId: string, revision: number, document: StudyData) {
    const { data, error } = await this.client.rpc("push_study_data", {
      expected_user_id: userId,
      expected_revision: revision,
      document: cloudData(document),
    });
    if (error)
      throw Object.assign(
        Error(
          error.code === "40001"
            ? "Cloud өөрчлөгдсөн. Дахин sync хийнэ үү."
            : `Cloud хадгалах: ${error.message}`,
        ),
        { code: error.code },
      );
    if (!data || !Number.isSafeInteger(data.revision))
      throw Error("Cloud хувилбар буруу байна.");
    return data.revision;
  }
}
export function cloudData(data: StudyData): StudyData {
  return { ...data, activeTimer: null };
}
function canonical(data: StudyData) {
  const d = cloudData(data);
  return stable({
    ...d,
    subjects: [...d.subjects].sort((a, b) => a.id.localeCompare(b.id)),
    sessions: [...d.sessions].sort((a, b) => a.id.localeCompare(b.id)),
    entries: [...d.entries].sort((a, b) => a.id.localeCompare(b.id)),
    tasks: [...d.tasks].sort((a, b) => a.id.localeCompare(b.id)),
    studyGoals: [...d.studyGoals].sort((a, b) => a.id.localeCompare(b.id)),
    musicSources: [...d.musicSources].sort((a, b) => a.id.localeCompare(b.id)),
    conflicts: [...d.conflicts].sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export class SyncEngine {
  private running: Promise<void> | null = null;
  constructor(
    private store: StudyStore,
    private adapter: CloudAdapter,
    readonly userId: string,
  ) {}
  sync(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.perform().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async perform() {
    const namespace = `account:${this.userId}`,
      check = () => {
        if (this.store.getSnapshot().namespace !== namespace)
          throw Error("Бүртгэл өөрчлөгдсөн тул sync зогслоо.");
      };
    check();
    const baseline = await this.store.repository.metadata<CloudSnapshot>(
        `cloud:${this.userId}`,
      ),
      remote = await this.adapter.pull(this.userId);
    check();
    await this.store.mutate((local) => {
      check();
      const merged = {
        ...mergeData(
          cloudData(local),
          remote.data,
          baseline?.data ? migrate(baseline.data) : undefined,
        ),
        activeTimer: local.activeTimer,
      };
      return canonical(local) === canonical(merged) ? local : merged;
    });
    check();
    const upload = cloudData(this.store.getSnapshot().data);
    const revision =
      canonical(upload) === canonical(remote.data)
        ? remote.revision
        : await this.adapter.push(this.userId, remote.revision, upload);
    check();
    await this.store.repository.setMetadata(`cloud:${this.userId}`, {
      revision,
      data: upload,
    });
    await this.store.repository.setMetadata(
      `last-sync:${this.userId}`,
      Date.now(),
    );
  }
}
