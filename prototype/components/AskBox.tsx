"use client";
import { useState } from "react";

type AskResult = {
  answer: string;
  recommendation: string;
  expert_count: number;
  public_count: number;
  latency_ms: number;
  citations: {
    rank: number;
    cite_type: string;
    author: string | null;
    text: string;
    similarity: number;
  }[];
};

export function AskBox({
  domainSlug,
  productSlug,
}: {
  domainSlug: string;
  productSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, domain: domainSlug, product: productSlug }),
      });
      if (!r.ok) {
        setError(`서버 오류 ${r.status}`);
        return;
      }
      setResult(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold mb-3">⚡ 직접 물어보세요</h2>
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder='예: "민감성 피부에 괜찮나요?"'
          className="flex-1 px-3 py-2 text-sm rounded-md border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <button
          onClick={send}
          disabled={loading || !query.trim()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white disabled:bg-zinc-300"
        >
          {loading ? "분석 중…" : "물어보기"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          "민감성 피부에 괜찮나요?",
          "향이 어떤가요?",
          "가성비는 어떤가요?",
          "재구매할 만한가요?",
        ].map((q) => (
          <button
            key={q}
            onClick={() => setQuery(q)}
            className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-zinc-500 bg-zinc-50 p-3 rounded-md">⚠️ {error}</p>
      )}

      {result && (
        <div className="space-y-3 mt-3">
          <div className="rounded-md border border-zinc-200 bg-zinc-50/40 p-3">
            <div className="text-xs font-semibold text-zinc-500 mb-1">💡 답변</div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {result.answer}
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-xs font-semibold text-amber-700 mb-1">✅ 추천</div>
            <p className="text-sm">{result.recommendation}</p>
          </div>
          <div className="text-xs text-zinc-500">
            📚 전문가 {result.expert_count}건 · 일반 {result.public_count}건 ·{" "}
            {result.latency_ms}ms
          </div>
          <div className="space-y-1.5">
            {result.citations.map((c) => (
              <div
                key={c.rank}
                className="text-xs px-3 py-2 rounded-md bg-zinc-50 border border-zinc-100"
              >
                <span
                  className={`font-semibold ${
                    c.cite_type === "expert" ? "text-indigo-600" : "text-amber-700"
                  }`}
                >
                  [{c.rank}] {c.cite_type}
                </span>{" "}
                <span className="text-zinc-500">
                  sim={c.similarity.toFixed(3)} · {c.author}
                </span>
                <p className="mt-1 text-zinc-700">{c.text.slice(0, 180)}…</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
