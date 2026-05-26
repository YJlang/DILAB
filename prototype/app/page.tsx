import Link from "next/link";
import { AnalyzeForm } from "@/components/AnalyzeForm";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="max-w-2xl text-center space-y-8 w-full">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex w-10 h-10 rounded-lg bg-indigo-600 text-white items-center justify-center text-xl font-bold">
              D
            </span>
            <h1 className="text-3xl font-bold tracking-tight">DILAB</h1>
          </div>
          <p className="text-lg text-zinc-700 leading-relaxed">
            리뷰가 아무리 많아도, <strong>전문가 한 마디</strong>가 없으면 결정이
            어렵죠.
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-md mx-auto">
            제품명을 입력하면 네이버 후기 + 전문가 글을 자동 수집해 *어디서 가져온
            결론인지* 매번 보여주는 리포트를 만들어요.
          </p>
        </div>

        <div className="flex justify-center">
          <AnalyzeForm />
        </div>

        <div className="pt-4 border-t border-zinc-200 space-y-3">
          <p className="text-xs text-zinc-500">바로가기</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/dashboard"
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
            >
              📊 도메인 대시보드
            </Link>
            <Link
              href="/ask"
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700"
            >
              ⚡ Ask 풀 화면
            </Link>
            <Link
              href="/topics"
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
            >
              🧩 토픽 탐색
            </Link>
            <Link
              href="/products/anua-heartleaf-77"
              className="text-sm font-medium px-3 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
            >
              ▶ 아누아 토너 리포트
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
