const key = (namespace: string, id: string) =>
  `togtmol:v3:note:${JSON.stringify([namespace, id])}`;
export function readTimerDraft(
  namespace: string,
  id: string,
  fallback: string,
) {
  try {
    return typeof localStorage === "undefined"
      ? fallback
      : (localStorage.getItem(key(namespace, id)) ?? fallback);
  } catch {
    return fallback;
  }
}
export function writeTimerDraft(namespace: string, id: string, note: string) {
  localStorage.setItem(key(namespace, id), note);
}
export function clearTimerDraft(namespace: string, id: string) {
  try {
    localStorage.removeItem(key(namespace, id));
  } catch {
    /* The saved result is already durable; an unused draft is harmless. */
  }
}
