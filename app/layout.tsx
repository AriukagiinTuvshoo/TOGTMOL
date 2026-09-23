import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./v7-fast-pass.css";
import "./world.css";
import "./knowledge.css";
import "./neon.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://togtmol.tuvshoo0331.workers.dev",
  ),
  title: "Тогтмол — Бондооктой хамт суралцъя",
  description:
    "Өөрийн орон зайдаа төвлөрч, мэдлэгээ хадгалж, өдөр бүр бага багаар ахиц гаргаарай.",
  applicationName: "Тогтмол",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Тогтмол" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    title: "Тогтмол — Бондооктой хамт суралцъя",
    description:
      "Өөрийн орон зайдаа төвлөрч, мэдлэгээ хадгалж, өдөр бүр бага багаар ахиц гаргаарай.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Тогтмол аппын лого",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Тогтмол — Бондооктой хамт суралцъя",
    description:
      "Өөрийн орон зайдаа төвлөрч, мэдлэгээ хадгалж, өдөр бүр бага багаар ахиц гаргаарай.",
    images: ["/icons/icon-512.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#050816" },
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
