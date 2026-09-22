import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./world.css";
import "./knowledge.css";
import "./neon.css";
export const metadata: Metadata = {
  title: "Тогтмол v5 — Бондооктой хамт суралцъя",
  description:
    "Өөрийн өрөөндөө төвлөрч, тэмдэглэлээ хадгалж, картаар давтаарай. Бондооктой хамт нэг жижиг алхмаас эхэлье.",
  applicationName: "Тогтмол",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Тогтмол" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
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
