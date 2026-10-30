import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR, Space_Grotesk } from "next/font/google";
import "./globals.css";

const kr = Noto_Sans_KR({ weight: ["400", "500", "700", "900"], subsets: ["latin"], variable: "--font-kr", display: "swap" });
const grotesk = Space_Grotesk({ weight: ["700"], subsets: ["latin"], variable: "--font-grotesk", display: "swap" });

const OG = "https://d8j0ntlcm91z4.cloudfront.net/user_37v9hge1XsR4EQQ1bvcBaDNhtel/hf_20261008_021947_f25de514-fb16-477b-89dc-81d058ac3cf0.png";

export const metadata: Metadata = {
  title: "랠리보드",
  description: "코트 잡았으면 일정 올리고, 참석·불참·대기 순번까지 한 번에. NTRP 제한, 혼복·남복·여복, 비용 N빵 자동 계산.",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "랠리보드", statusBarStyle: "default" },
  openGraph: { title: "랠리보드", description: "코트 잡았어? 여기 올려. 참석·대기·N빵까지 한 번에.", images: [OG], type: "website" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0e4434" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${kr.variable} ${grotesk.variable}`}>
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
