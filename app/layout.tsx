import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://woomaking.github.io/voicepath-vocal-trainer/"),
  title: "보이스패스 | 발성 연습",
  description: "5음계 피치 연습과 흉성·중성·두성·가성 발성 학습을 돕는 모바일 보컬 트레이닝 앱",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/voicepath-icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "보이스패스 | 발성 연습",
    description: "소리를 이해하고, 편안하게 연결해요",
    url: "https://woomaking.github.io/voicepath-vocal-trainer/",
    siteName: "보이스패스",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "보이스패스 발성 연습 앱" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#167a68",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
