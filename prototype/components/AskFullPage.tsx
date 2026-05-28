"use client";
import { useEffect, useRef, useState } from "react";

type Citation = {
  rank: number;
  cite_type: string;
  author: string | null;
  text: string;
  similarity: number;
  author_credibility: number | null;
};

type Turn = {
  id: string;
  query: string;
  loading: boolean;
  error?: string;
  answer?: string;
  recommendation?: string;
  citations?: Citation[];
  llm_model?: string;
  latency_ms?: number;
  expert_count?: number;
  public_count?: number;
};

const CATEGORIES: { tag: string; items: string[] }[] = [
  {
    tag: "✨ 효능",
    items: [
      "진정 효과는 어떤가요?",
      "트러블에 도움 되나요?",
      "보습력은 충분한가요?",
    ],
  },
  {
    tag: "🧪 성분",
    items: [
      "주요 성분이 뭐예요?",
      "어성초 함량의 의미는?",
      "민감 피부에 자극되는 성분 있나요?",
    ],
  },
  {
    tag: "💰 가성비",
    items: ["가성비는 어떤가요?", "용량 대비 가치는?"],
  },
  {
    tag: "👃 향·사용감",
    items: ["향이 어떤가요?", "끈적임 없나요?", "산뜻한 편인가요?"],
  },
  {
    tag: "🌿 피부 타입",
    items: ["민감성 피부에 괜찮나요?", "지성·복합성 피부에도 맞나요?"],
  },
  {
    tag: "🔁 재구매",
    items: ["재구매할 만한가요?", "꾸준히 써야 효과 보이나요?"],
  },
];

export function AskFullPage({
  domain,
  initialProduct,
  products,
}: {
  domain: string;
  initialProduct: string | null;
  products: Array<{ slug: string; name: string; brand: string | null }>;
}) {
  const [productSlug, setProductSlug] = useState(
    initialProduct ?? products[0]?.slug ?? ""
  );
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send(q?: string) {
    const queryToSend = (q ?? query).trim();
    if (!queryToSend) return;

    const turnId = `t${Date.now()}`;
    setTurns((prev) => [
      ...prev,
      { id: turnId, query: queryToSend, loading: true },
    ]);
    setQuery("");

    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryToSend,
          domain,
          product: productSlug || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  loading: false,
                  error: data.error ?? `HTTP ${r.status}`,
                }
              : t
          )
        );
        return;
      }
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                loading: false,
                answer: data.answer,
                recommendation: data.recommendation,
                citations: data.citations,
                llm_model: data.llm_model,
                latency_ms: data.latency_ms,
                expert_count: data.expert_count,
                public_count: data.public_count,
              }
            : t
        )
      );
    } catch (e) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, loading: false, error: String(e) } : t
        )
      );
    }
  }

  const currentProduct = products.find((p) => p.slug === productSlug);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <header className="border-b border-zinc-200 pb-4 mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs text-zinc-500 mb-2">⚡ 자연어 질의 응답</div>
          <h1 className="text-2xl font-bold tracking-tight">Ask</h1>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ask-product" className="text-xs text-zinc-500">
            📦 분석 대상
          </label>
          <select
            id="ask-product"
            value={productSlug}
            onChange={(e) => {
              setProductSlug(e.target.value);
              setTurns([]);
            }}
            className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 bg-white max-w-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <option value="">{`도메인 전체 (${domain})`}</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name.length > 50 ? p.name.slice(0, 50) + "…" : p.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 모바일에선 대화가 위, 예시는 아래로 collapse */}
        <aside className="order-2 lg:order-1 lg:col-span-3 space-y-3">
          <details className="lg:open:block bg-white rounded-lg border border-zinc-200 p-4 shadow-sm" open>
            <summary className="text-xs font-semibold text-zinc-500 tracking-wide uppercase cursor-pointer lg:cursor-default list-none">
              💭 예시 질문
            </summary>
            <div className="space-y-3 mt-3">
              {CATEGORIES.map((c) => (
                <div key={c.tag}>
                  <div className="text-xs font-semibold text-zinc-700 mb-1.5">
                    {c.tag}
                  </div>
                  <div className="space-y-1">
                    {c.items.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-indigo-50 text-zinc-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </aside>

        {/* 우측 — 대화 */}
        <section className="order-1 lg:order-2 lg:col-span-9 space-y-4">
          <div className="min-h-[60vh] bg-white rounded-lg border border-zinc-200 p-5 shadow-sm">
            {turns.length === 0 ? (
              <EmptyState productName={currentProduct?.name} />
            ) : (
              <div className="space-y-6">
                {turns.map((t) => (
                  <TurnView key={t.id} turn={t} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* 입력 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='예: "민감성 피부에 괜찮을까요?"'
              className="flex-1 px-4 py-3 text-sm rounded-md border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="px-5 py-3 text-sm font-medium rounded-md bg-indigo-600 text-white disabled:bg-zinc-300 hover:bg-indigo-700"
            >
              물어보기 ▶
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function EmptyState({ productName }: { productName: string | undefined }) {
  return (
    <div className="text-center py-16 text-zinc-500">
      <div className="text-4xl mb-3">💬</div>
      <p className="text-sm">
        {productName ? (
          <>
            <strong className="text-zinc-700">{productName}</strong> 에 대해
            궁금한 것을 물어보세요.
          </>
        ) : (
          "분석된 제품에 대해 자유롭게 질문해 보세요."
        )}
      </p>
      <p className="text-xs mt-2">
        왼쪽 예시 질문을 클릭하거나, 아래 입력창에 직접 입력하면 돼요.
      </p>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-sm">
          {turn.query}
        </div>
      </div>

      {turn.loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          분석 중…
        </div>
      )}

      {turn.error && (
        <div className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md p-3">
          ⚠️ {turn.error}
        </div>
      )}

      {turn.answer && (
        <div className="space-y-2.5">
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800">
              {turn.answer}
            </p>
          </div>

          {turn.recommendation && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
              <div className="text-xs font-semibold text-amber-700 mb-1">
                ✅ 추천
              </div>
              <p className="text-sm">{turn.recommendation}</p>
            </div>
          )}

          <div className="text-xs text-zinc-500">
            📚 전문가 {turn.expert_count ?? 0}건 · 일반 {turn.public_count ?? 0}건
            · {turn.llm_model} · {turn.latency_ms}ms
          </div>

          {turn.citations && turn.citations.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-zinc-600 hover:text-indigo-700 font-medium">
                📖 출처 청크 {turn.citations.length}개 펼쳐 보기
              </summary>
              <div className="mt-2 space-y-1.5">
                {turn.citations.map((c) => (
                  <div
                    key={c.rank}
                    className="px-3 py-2 rounded-md bg-zinc-50 border border-zinc-100"
                  >
                    <div>
                      <span
                        className={`font-semibold ${
                          c.cite_type === "expert"
                            ? "text-indigo-600"
                            : "text-amber-700"
                        }`}
                      >
                        [{c.rank}] {c.cite_type}
                      </span>{" "}
                      <span className="text-zinc-500">
                        sim={c.similarity.toFixed(3)} · {c.author}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-700 leading-relaxed">
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
