import Link from "next/link";
import { CompareRadar } from "@/components/CompareRadar";
import { InsightsPanel } from "@/components/InsightsPanel";

export const dynamic = "force-dynamic";

const AI_WORKER =
  process.env.AI_WORKER_URL ?? "http://127.0.0.1:8000";

type Snapshot = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  ratings: Record<string, number>;
  top_keywords: string[];
  sentiment_dist: Record<string, number>;
  document_count: number;
};

type Diff = {
  axis: string;
  a_score: number;
  b_score: number;
  gap: number;
  winner: string;
};

type CompareData = {
  a: Snapshot;
  b: Snapshot;
  differentiators: Diff[];
  a_strengths: string[];
  b_strengths: string[];
  marketing_actions: string[];
  positioning_line: string;
  llm_model: string;
};

async function getCompare(a: string, b: string): Promise<CompareData> {
  const res = await fetch(`${AI_WORKER}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug_a: a, slug_b: b, domain_slug: "cosmetics" }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`compare ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ a: string; b: string }>;
}) {
  const { a, b } = await params;
  const data = await getCompare(a, b);

  const radarData = data.differentiators.map((d) => ({
    axis: d.axis,
    a: d.a_score,
    b: d.b_score,
  }));

  const aLabel = data.a.brand || data.a.name.slice(0, 12);
  const bLabel = data.b.brand || data.b.name.slice(0, 12);

  const aPosPct = totalPct(data.a.sentiment_dist);
  const bPosPct = totalPct(data.b.sentiment_dist);

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-6">
      <header className="border-b border-zinc-200 pb-4 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 hover:opacity-80"
          >
            <span className="inline-flex w-8 h-8 rounded-md bg-indigo-600 text-white items-center justify-center font-bold">
              D
            </span>
            <span className="text-lg font-bold tracking-tight">DILAB</span>
          </Link>
          <span className="text-xs text-zinc-500">⚖️ 데이터 기반 경쟁 비교</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight leading-relaxed">
          <span className="text-indigo-700">{data.a.name}</span>
          <span className="mx-3 text-zinc-400">vs</span>
          <span className="text-amber-700">{data.b.name}</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-2">
          <span className="text-indigo-700 font-medium">A 자사 {aLabel}</span> ·
          분석 문서 {data.a.document_count}건 ·{" "}
          긍정 {aPosPct}%
          <span className="mx-3 text-zinc-300">|</span>
          <span className="text-amber-700 font-medium">
            B 경쟁사 {bLabel}
          </span>{" "}
          · 분석 문서 {data.b.document_count}건 · 긍정 {bPosPct}%
        </p>
      </header>

      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-7 bg-white rounded-lg border border-zinc-200 p-5 shadow-sm">
          <h2 className="text-base font-bold mb-3">5축 비교</h2>
          <CompareRadar data={radarData} aLabel={aLabel} bLabel={bLabel} />

          <table className="w-full text-sm mt-4">
            <thead className="text-zinc-500 border-b border-zinc-200 text-xs">
              <tr>
                <th className="text-left py-2 font-medium">축</th>
                <th className="text-right font-medium">A</th>
                <th className="text-right font-medium">B</th>
                <th className="text-right font-medium">차이</th>
                <th className="text-right font-medium">우위</th>
              </tr>
            </thead>
            <tbody>
              {data.differentiators.map((d) => (
                <tr key={d.axis} className="border-b border-zinc-100">
                  <td className="py-2 font-medium">{d.axis}</td>
                  <td className="text-right tabular-nums">
                    {d.a_score.toFixed(1)}
                  </td>
                  <td className="text-right tabular-nums">
                    {d.b_score.toFixed(1)}
                  </td>
                  <td className="text-right tabular-nums text-zinc-500">
                    {d.gap > 0 ? "+" : ""}
                    {d.gap.toFixed(1)}
                  </td>
                  <td className="text-right text-xs">
                    {d.winner === "A" && (
                      <span className="text-indigo-600 font-bold">A</span>
                    )}
                    {d.winner === "B" && (
                      <span className="text-amber-700 font-bold">B</span>
                    )}
                    {d.winner === "tie" && (
                      <span className="text-zinc-400">=</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="col-span-5">
          <InsightsPanel
            aName={aLabel}
            bName={bLabel}
            aStrengths={data.a_strengths}
            bStrengths={data.b_strengths}
            actions={data.marketing_actions}
            positioning={data.positioning_line}
          />
        </div>
      </section>

      <footer className="mt-6 flex items-center justify-between text-xs text-zinc-500">
        <span>
          🤖 {data.llm_model} 합성 · 모든 데이터는 Supabase 실시간 조회 · 5축
          점수는 chunks 의 분류 × 감성 가중 평균
        </span>
        <div className="flex gap-3">
          <Link
            href={`/products/${a}`}
            className="text-indigo-600 hover:underline"
          >
            ← A 리포트
          </Link>
          <Link
            href={`/products/${b}`}
            className="text-amber-700 hover:underline"
          >
            B 리포트 →
          </Link>
        </div>
      </footer>
    </main>
  );
}

function totalPct(dist: Record<string, number>): number {
  const total =
    (dist.positive ?? 0) + (dist.neutral ?? 0) + (dist.negative ?? 0);
  if (total === 0) return 0;
  return Math.round(((dist.positive ?? 0) / total) * 100);
}
