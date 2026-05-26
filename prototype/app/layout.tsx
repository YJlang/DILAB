import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DILAB — 질로 답하는 제품 평가",
  description:
    "전문가 리뷰 DB + 공개 리뷰를 함께 분석해 *어디서 가져온 결론인지* 매번 보여주는 도메인 특화 RAG 제품 평가 서비스.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* Pretendard — 한국어 + 가독성 우선 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
