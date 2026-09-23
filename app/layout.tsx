import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./world.css";
import "./knowledge.css";
import "./neon.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://togtmol.vercel.app",
  ),
  title: "Тогтмол v6 — Бондооктой хамт суралцъя",
  description:
    "Өөрийн өрөөндөө төвлөрч, тэмдэглэлээ хадгалж, картаар давтаарай. Бондооктой хамт нэг жижиг алхмаас эхэлье.",
  applicationName: "Тогтмол",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Тогтмол" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    title: "Тогтмол — Бондооктой хамт суралцъя",
    description:
      "Өөрийн өрөөндөө төвлөрч, тэмдэглэлээ хадгалж, картаар давтаарай.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Тогтмол — Бондооктой хамт суралцъя",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Тогтмол — Бондооктой хамт суралцъя",
    description:
      "Өөрийн өрөөндөө төвлөрч, тэмдэглэлээ хадгалж, картаар давтаарай.",
    images: ["/opengraph-image"],
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#161a16" },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
