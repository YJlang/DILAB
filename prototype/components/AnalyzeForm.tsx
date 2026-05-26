"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AnalyzeResult = {
  product_id?: string;
  slug?: string;
  name?: string;
  brand?: string;
  documents_added?: number;
  elapsed_sec?: number;
  error?: string;
};

const EXAMPLES = [
  "닥터지 레드 블레미쉬 클리어 수딩 크림",
  "이니스프리 그린티 시드 세럼",
  "아비브 어성초 카밍 토너",
  "메디힐 NMF 마스크팩",
];

export function AnalyzeForm() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("");
  const router = useRouter();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setStage("📥 네이버에서 후기 + 성분 글 + 제품 메타 수집 중…");

    try {
      // 실제 분석은 동기 1분 — 백엔드가 5단계 다 돌고 응답
      // 클라이언트 UX 는 stage 메시지를 시간차로 갱신
      const stages = [
        "📥 네이버 검색 (후기 30 + 성분 15)",
        "🧩 BGE-M3 임베딩 + Supabase 저장",
        "🤖 DeepSeek 분류·감성·여정 라벨링",
        "📊 5축 평가 점수 산출",
      ];
      let i = 0;
      const ticker = setInterval(() => {
        if (i < stages.length) {
          setStage(stages[i]);
          i++;
        }
      }, 15000);

      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_query: query.trim() }),
      });
      clearInterval(ticker);

      if (!r.ok) {
        setError(`분석 실패 (${r.status})`);
        return;
      }
      const data: AnalyzeResult = await r.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (!data.slug) {
        setError("리포트 slug 가 반환되지 않았어요");
        return;
      }
      setStage(`✅ 완료 — ${data.documents_added}건 분석 (${data.elapsed_sec}초)`);
      router.push(`/products/${data.slug}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-xl space-y-3"
    >
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='제품명 입력 — 예: "닥터지 레드 블레미쉬 크림"'
          disabled={loading}
          className="flex-1 px-4 py-3 text-sm rounded-md border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-3 text-sm font-medium rounded-md bg-indigo-600 text-white disabled:bg-zinc-300 hover:bg-indigo-700"
        >
          {loading ? "분석 중…" : "분석 시작 ▶"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuery(q)}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-zinc-600 bg-indigo-50/50 border border-indigo-100 rounded-md px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            {stage}
          </div>
          <div className="text-xs text-zinc-500 mt-1.5">
            약 1분 소요 (네이버 검색 + BGE-M3 임베딩 + DeepSeek 라벨링 + 5축 산출)
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-md">
          ⚠️ {error}
        </p>
      )}
    </form>
  );
}
