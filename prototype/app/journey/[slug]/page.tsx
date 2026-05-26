import Link from "next/link";
import {
  getDomain,
  getJourneyDetail,
  getProductBySlug,
  type JourneyChunkDetail,
} from "@/lib/data";

export const dynamic = "force-dynamic";

const SENTIMENT_EMOJI = {
  positive: "😊",
  neutral: "😐",
  negative: "😣",
  unknown: "❓",
} as const;

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const domain = await getDomain("cosmetics");
  const product = await getProductBySlug(domain.id, slug);
  const grouped = await getJourneyDetail(product.id);
  const stages = (domain.journey_stages ?? []).sort(
    (a, b) => a.order - b.order
  );

  const totalChunks = Object.values(grouped).reduce(
    (s, arr) => s + arr.length,
    0
  );

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-6">
      <header className="border-b border-zinc-200 pb-4 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80">
            <span className="inline-flex w-8 h-8 rounded-md bg-indigo-600 text-white items-center justify-center font-bold">
              D
            </span>
            <span className="text-lg font-bold tracking-tight">DILAB</span>
          </Link>
          <span className="text-xs text-zinc-500">🗺️ 사용자 여정 지도</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {product.brand} · 총 {totalChunks}건의 청크가 여정 단계에 매핑됨
        </p>
      </header>

      {/* 퍼널 */}
      <section className="mb-5 bg-white rounded-lg border border-zinc-200 p-5 shadow-sm">
        <h2 className="text-base font-bold mb-4">단계별 언급 + 감성 분포</h2>
        <div className="grid grid-cols-4 gap-3">
          {stages.map((s, i) => {
            const items = grouped[s.key] ?? [];
            const n = items.length;
            const pos = items.filter((x) => x.sentiment === "positive").length;
            const neu = items.filter((x) => x.sentiment === "neutral").length;
            const neg = items.filter((x) => x.sentiment === "negative").length;
            const posPct = n > 0 ? Math.round((pos / n) * 100) : 0;
            const isLast = s.key === "rebuy";
            return (
              <div
                key={s.key}
                className={`rounded-md p-4 border ${
                  isLast
                    ? "bg-amber-50/50 border-amber-200"
                    : "bg-zinc-50 border-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-6 h-6 rounded-full text-white grid place-items-center text-xs font-bold ${
                      isLast ? "bg-amber-500" : "bg-indigo-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isLast ? "text-amber-700" : "text-zinc-700"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums">{n}</div>
                <div className="text-xs text-zinc-500">건 언급</div>
                <div className="flex gap-1 mt-3 text-xs">
                  <span className="text-indigo-600 font-semibold">
                    😊 {posPct}%
                  </span>
                  {neu > 0 && (
                    <span className="text-zinc-500">😐 {Math.round((neu/n)*100)}%</span>
                  )}
                  {neg > 0 && (
                    <span className="text-zinc-500">😣 {Math.round((neg/n)*100)}%</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 단계별 청크 인용 */}
      <section className="grid grid-cols-2 gap-5">
        {stages.map((s) => {
          const items = grouped[s.key] ?? [];
          return (
            <StageDetail
              key={s.key}
              order={s.order}
              label={s.label}
              chunks={items}
            />
          );
        })}
      </section>

      <footer className="mt-6 flex items-center justify-between text-xs text-zinc-500">
        <span>
          * LLM zero-shot 분류 — 정확도 약 80%. 청크 내 시점 단서를 추정한 결과예요.
        </span>
        <Link
          href={`/products/${slug}`}
          className="text-indigo-600 hover:underline"
        >
          ← 리포트로 돌아가기
        </Link>
      </footer>
    </main>
  );
}

function StageDetail({
  order,
  label,
  chunks,
}: {
  order: number;
  label: string;
  chunks: JourneyChunkDetail[];
}) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white grid place-items-center text-xs font-bold">
          {order}
        </span>
        <h3 className="text-base font-bold">{label}</h3>
        <span className="text-xs text-zinc-500">— {chunks.length}건</span>
      </div>
      {chunks.length === 0 ? (
        <p className="text-sm text-zinc-400 italic">이 단계는 비어 있어요.</p>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-auto">
          {chunks.slice(0, 8).map((c) => (
            <div
              key={c.chunk_id}
              className="px-3 py-2.5 rounded-md bg-zinc-50 border border-zinc-100"
            >
              <div className="flex items-center gap-2 text-xs mb-1">
                <span>{SENTIMENT_EMOJI[c.sentiment]}</span>
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
                <span className="text-zinc-400 ml-auto">
                  conf {c.confidence.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                {c.text.length > 200 ? c.text.slice(0, 200) + "…" : c.text}
              </p>
            </div>
          ))}
          {chunks.length > 8 && (
            <p className="text-xs text-zinc-400 text-center pt-1">
              + {chunks.length - 8}건 더 있음
            </p>
          )}
        </div>
      )}
    </div>
  );
}
