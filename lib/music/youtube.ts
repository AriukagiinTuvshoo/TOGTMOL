export interface YouTubeSource {
  kind: "video" | "playlist";
  youtubeId: string;
}
const video = /^[a-zA-Z0-9_-]{11}$/;
const playlist = /^[a-zA-Z0-9_-]{10,100}$/;
export function parseYouTube(input: string): YouTubeSource {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw Error("YouTube холбоосоо бүтнээр нь оруулна уу.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw Error("YouTube холбоос буруу байна.");
  const hosts = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtube-nocookie.com",
  ];
  if (!hosts.includes(url.hostname))
    throw Error("Зөвхөн YouTube-ийн video эсвэл playlist холбоос оруулна уу.");
  const path = url.pathname.split("/").filter(Boolean);
  const list = url.searchParams.get("list");
  if (
    list &&
    playlist.test(list) &&
    ["watch", "playlist", "embed"].includes(path[0])
  )
    return { kind: "playlist", youtubeId: list };
  const id =
    url.hostname === "youtu.be"
      ? path[0]
      : path[0] === "watch"
        ? url.searchParams.get("v")
        : ["embed", "shorts", "live"].includes(path[0])
          ? path[1]
          : null;
  if (!id || !video.test(id))
    throw Error("Бичлэг эсвэл playlist-ийн дугаар танигдсангүй.");
  return { kind: "video", youtubeId: id };
}
export function validYouTubeSource(kind: unknown, id: unknown): boolean {
  return (
    typeof id === "string" &&
    (kind === "video"
      ? video.test(id)
      : kind === "playlist" && playlist.test(id))
  );
}
export function youtubeURL(source: YouTubeSource): string {
  return source.kind === "video"
    ? `https://www.youtube.com/watch?v=${source.youtubeId}`
    : `https://www.youtube.com/playlist?list=${source.youtubeId}`;
}
