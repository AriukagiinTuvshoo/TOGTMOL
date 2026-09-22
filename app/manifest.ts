import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Тогтмол — Бондоокийн суралцах өрөө",
    short_name: "Тогтмол",
    description: "Бондооктой хамт. Нэг өдөр. Нэг жижиг алхам.",
    lang: "mn",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f0",
    theme_color: "#344936",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
