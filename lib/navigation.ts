import type { View } from "@/types/study";

const APP_VIEWS = new Set<View>([
  "overview",
  "timer",
  "calendar",
  "subjects",
  "statistics",
  "goals",
  "achievements",
  "assistant",
  "settings",
  "room",
  "focus",
  "knowledge",
  "privacy",
]);

export type AppLocation = {
  view: View;
  recordId: string | null;
};

/**
 * Turns the URL hash into app state. Unknown or malformed hashes always return
 * the safe home view so old bookmarks can never leave the shell blank.
 */
export function parseAppHash(hash: string): AppLocation {
  const raw = hash.replace(/^#\/?/, "");
  if (!raw) return { view: "overview", recordId: null };
  const [candidate, ...recordParts] = raw.split("/");
  if (!APP_VIEWS.has(candidate as View))
    return { view: "overview", recordId: null };

  let recordId: string | null = null;
  if (recordParts.length) {
    try {
      recordId = decodeURIComponent(recordParts.join("/")) || null;
    } catch {
      recordId = null;
    }
  }
  return { view: candidate as View, recordId };
}

/** Creates a shareable in-app URL without involving the server router. */
export function appHash(view: View, recordId?: string | null): string {
  const base = `#/${view}`;
  return recordId ? `${base}/${encodeURIComponent(recordId)}` : base;
}
