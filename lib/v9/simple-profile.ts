// Simple Local-First Profile Manager (Name + Password + Cute Avatar -> Dedicated StudyStore Namespace)

export interface SimpleProfile {
  id: string;
  name: string;
  avatar: string;
  motto: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number;
}

const PROFILES_KEY = "togtmol:simple-profiles:v1";
const ACTIVE_PROFILE_KEY = "togtmol:active-profile:v1";

export const PROFILE_AVATARS = [
  "🦊",
  "🐱",
  "🐻",
  "🐰",
  "🐼",
  "🐨",
  "🦉",
  "🐧",
  "🦋",
  "🌸",
  "🧋",
  "🎧",
  "✨",
  "🚀",
] as const;

const listeners = new Set<() => void>();
let activeProfileSnapshot: SimpleProfile | null | undefined;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeSimpleProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function hashProfilePassword(
  name: string,
  password: string,
): Promise<string> {
  const normalized = `${name.trim().toLocaleLowerCase()}::${password}`;
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    const buf = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback deterministic hash for non-subtle test environments
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a-${(h >>> 0).toString(16)}`;
}

export function readSimpleProfiles(): SimpleProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is SimpleProfile =>
      Boolean(
        p &&
        typeof p === "object" &&
        typeof (p as SimpleProfile).id === "string" &&
        typeof (p as SimpleProfile).name === "string" &&
        typeof (p as SimpleProfile).passwordHash === "string",
      ),
    );
  } catch {
    return [];
  }
}

function writeSimpleProfiles(list: SimpleProfile[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function readActiveSimpleProfile(): SimpleProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const activeId = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!activeId) return null;
    return readSimpleProfiles().find((p) => p.id === activeId) ?? null;
  } catch {
    return null;
  }
}

export function getActiveSimpleProfileSnapshot(): SimpleProfile | null {
  if (typeof window === "undefined") return null;
  if (activeProfileSnapshot === undefined) {
    activeProfileSnapshot = readActiveSimpleProfile();
  }
  return activeProfileSnapshot;
}

export function setActiveSimpleProfileId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  } catch {
    /* ignore */
  }
  activeProfileSnapshot = id ? readActiveSimpleProfile() : null;
  notify();
}

export function namespaceForProfile(profileId: string): string {
  return `profile:${profileId}`;
}

export async function loginOrCreateSimpleProfile(params: {
  name: string;
  password: string;
  avatar?: string;
  motto?: string;
}): Promise<
  | { ok: true; profile: SimpleProfile; isNew: boolean }
  | { ok: false; error: string }
> {
  const cleanName = params.name.trim().slice(0, 40);
  if (cleanName.length < 2) {
    return { ok: false, error: "Нэрээ 2-оос дээш тэмдэгтээр оруулна уу 🌸" };
  }
  if (params.password.length < 4) {
    return {
      ok: false,
      error: "Нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой 🔐",
    };
  }

  const profiles = readSimpleProfiles();
  const hash = await hashProfilePassword(cleanName, params.password);
  const existing = profiles.find(
    (p) => p.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
  );

  if (existing) {
    if (existing.passwordHash !== hash) {
      return {
        ok: false,
        error: "Энэ нэртэй профайлын нууц үг таарахгүй байна 🙈",
      };
    }
    const updated: SimpleProfile = {
      ...existing,
      avatar: params.avatar || existing.avatar,
      motto: params.motto?.trim()
        ? params.motto.trim().slice(0, 80)
        : existing.motto,
      lastLoginAt: Date.now(),
    };
    writeSimpleProfiles(
      profiles.map((p) => (p.id === existing.id ? updated : p)),
    );
    setActiveSimpleProfileId(updated.id);
    return { ok: true, profile: updated, isNew: false };
  }

  const slug = cleanName
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  const id = `${slug || "user"}-${Date.now().toString(36).slice(-5)}`;
  const created: SimpleProfile = {
    id,
    name: cleanName,
    avatar: params.avatar || "🦊",
    motto: params.motto?.trim().slice(0, 80) || "Өдөр бүр жижиг алхмаар ✨",
    passwordHash: hash,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  writeSimpleProfiles([created, ...profiles]);
  setActiveSimpleProfileId(created.id);
  return { ok: true, profile: created, isNew: true };
}

export function updateActiveProfileMeta(patch: {
  avatar?: string;
  motto?: string;
}) {
  const active = readActiveSimpleProfile();
  if (!active) return;
  const profiles = readSimpleProfiles();
  const updated: SimpleProfile = {
    ...active,
    ...(patch.avatar ? { avatar: patch.avatar } : {}),
    ...(patch.motto !== undefined ? { motto: patch.motto.slice(0, 80) } : {}),
  };
  writeSimpleProfiles(profiles.map((p) => (p.id === active.id ? updated : p)));
  activeProfileSnapshot = updated;
  notify();
}
