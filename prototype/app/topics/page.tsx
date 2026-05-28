import { getTopicsWithChunks } from "@/lib/data";

export const dynamic = "force-dynamic";

const SENT_EMOJI: Record<string, string> = {
  positive: "😊",
  neutral: "😐",
  negative: "😣",
  unknown: "❓",
};

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const params = await searchParams;
  const topics = await getTopicsWithChunks(params.domain ?? "cosmetics");

  const total = topics.reduce((s, t) => s + t.doc_count, 0);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <header className="border-b border-zinc-200 pb-4 mb-5">
        <div className="text-xs text-zinc-500 mb-2">🧩 토픽 탐색 (BERTopic)</div>
        <h1 className="text-2xl font-bold tracking-tight">
          🌿 화장품 — {topics.length}개 토픽 클러스터
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          BGE-M3 임베딩 → UMAP 차원 축소 → HDBSCAN 클러스터링. 총 {total} chunks
          분류됨.
        </p>
      </header>

      {topics.length === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center text-zinc-500 text-sm">
          토픽이 아직 분리되지 않았어요. <code>scripts/run_topics.py</code>{" "}
          실행 후 다시 보세요.
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {topics.map((t) => (
            <TopicCard key={t.id} t={t} total={total} />
          ))}
        </section>
      )}

      <footer className="mt-6 text-xs text-zinc-500">
        💡 청크 수가 적은 도메인 (≤50) 은 토픽 분리가 작거나 불완전할 수 있어요.
        제품 더 추가 분석 후 <code>run_topics.py</code> 재실행 시 토픽이 더
        세분화됩니다.
      </footer>
    </main>
  );
}

function TopicCard({
  t,
  total,
}: {
  t: import("@/lib/data").TopicWithChunks;
  total: number;
}) {
  const pct = total > 0 ? Math.round((t.doc_count / total) * 100) : 0;
  const sentTotal =
    t.sentiment.positive + t.sentiment.neutral + t.sentiment.negative;
  const posPct =
    sentTotal > 0
      ? Math.round((t.sentiment.positive / sentTotal) * 100)
      : 0;

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-700 grid place-items-center text-xs font-bold tabular-nums">
          {t.topic_index}
        </span>
        <h2 className="text-base font-bold flex-1">
          {t.keywords.slice(0, 3).join(" · ")}
        </h2>
        <span className="text-xs text-zinc-500 tabular-nums">
          {pct}% ({t.doc_count})
        </span>
      </div>

      {/* 키워드 칩 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {t.keywords.map((kw) => (
          <span
            key={kw}
            className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"
          >
            #{kw}
          </span>
        ))}
      </div>

      {/* 감성 mini bar */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-zinc-500">감성</span>
        <div className="flex-1 h-1.5 bg-zinc-100 rounded-sm overflow-hidden flex">
          <div
            className="bg-indigo-500"
            style={{
              width: `${(t.sentiment.positive / Math.max(sentTotal, 1)) * 100}%`,
            }}
          />
          <div
            className="bg-amber-400"
            style={{
              width: `${(t.sentiment.neutral / Math.max(sentTotal, 1)) * 100}%`,
            }}
          />
          <div
            className="bg-zinc-400"
            style={{
              width: `${(t.sentiment.negative / Math.max(sentTotal, 1)) * 100}%`,
            }}
          />
        </div>
        <span className="text-indigo-600 font-semibold tabular-nums">
          😊 {posPct}%
        </span>
      </div>

      {/* 대표 청크 */}
      <div className="space-y-1.5 mt-3">
        <div className="text-xs font-semibold text-zinc-500">
          📖 대표 청크 (상위 {Math.min(t.chunks.length, 5)}개)
        </div>
        {t.chunks.slice(0, 5).map((c) => (
          <div
            key={c.chunk_id}
            className="px-3 py-2 rounded-md bg-zinc-50 border border-zinc-100 text-xs"
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{SENT_EMOJI[c.sentiment]}</span>
              <span
                className={`font-semibold ${
                  c.source_type === "expert"
                    ? "text-indigo-600"
                    : "text-amber-700"
                }`}
              >
                {c.source_type === "expert" ? "전문가" : "사용자"}
              </span>
              <span className="text-zinc-500">{c.author ?? "익명"}</span>
            </div>
            <p className="text-zinc-700 leading-relaxed">
              {c.text.length > 140 ? c.text.slice(0, 140) + "…" : c.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
