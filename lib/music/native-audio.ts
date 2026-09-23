export interface NativeAudioDescriptor {
  url?: string;
  storageKey?: string;
}
const storageKeyPattern = /^musicblob_[A-Za-z0-9_-]{8,160}$/;

export function isVideoMedia(url?: string | null, mimeType?: string | null) {
  return (
    mimeType === "video/mp4" ||
    /\\.mp4(?:$|[?#])/i.test(url ?? "")
  );
}

export function parseAudioURL(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw Error("Аудио холбоосоо бүтнээр нь оруулна уу.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw Error("Аудио холбоос буруу байна.");
  return url.toString();
}

export function validAudioDescriptor(
  url: unknown,
  storageKey: unknown,
): boolean {
  if (typeof storageKey === "string" && storageKeyPattern.test(storageKey))
    return true;
  if (typeof url !== "string" || !url) return false;
  try {
    parseAudioURL(url);
    return true;
  } catch {
    return false;
  }
}

export function validAudioStorageKey(value: unknown): value is string {
  return typeof value === "string" && storageKeyPattern.test(value);
}
