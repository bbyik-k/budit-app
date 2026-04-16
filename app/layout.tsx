import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Noto_Sans_KR } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Header from "@/components/layout/header";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "부딪 | 화장품 성분 충돌 분석",
  description:
    "두 화장품의 성분 충돌 여부를 빠르게 확인하세요. 민감성 피부를 위한 성분 안전 분석 서비스.",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${notoSansKR.variable} flex min-h-screen flex-col font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* 공통 헤더 */}
          <Header />
          {/* 페이지 콘텐츠 */}
          <main className="flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
