import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Тогтмол — Бондоокийн суралцах өрөө",
    short_name: "Тогтмол",
    description: "Бондооктой хамт. Нэг өдөр. Нэг жижиг алхам. 🐾✨",
    id: "/",
    lang: "mn",
    start_url: "/#/overview",
    scope: "/",
    display: "standalone",
    orientation: "any",
    categories: ["education", "productivity", "lifestyle"],
    background_color: "#0b0e1a",
    theme_color: "#6366f1",
    shortcuts: [
      {
        name: "⏱ Төвлөрөх цаг",
        short_name: "Төвлөрөх",
        description: "Шууд суралцах цагаа эхлүүлэх",
        url: "/#/timer",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "📚 Миний мэдлэг",
        short_name: "Мэдлэг",
        description: "Тэмдэглэл, карт, давтлагаа нээх",
        url: "/#/knowledge",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "🐾 Бондоок AI",
        short_name: "Бондоок",
        description: "AI дасгалжуулагч ба зургаас хичээл задлах",
        url: "/#/assistant",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "🎯 Зорилго & Шалгалт",
        short_name: "Зорилго",
        description: "Шалгалтын тоолол ба суралцах төлөвлөгөө",
        url: "/#/goals",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
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
