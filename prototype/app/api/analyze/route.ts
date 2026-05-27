/**
 * 제품 자동 분석 API — Next.js → ai-worker /analyze 프록시.
 *
 * 동기 실행 약 60~90초:
 *   네이버 검색 → 임베딩 → DeepSeek 라벨 → ratings
 *
 * 다음 단계 (비동기 + SSE 진행률) 는 production 수준 작업.
 */
import { NextResponse } from "next/server";

const AI_WORKER =
  process.env.AI_WORKER_URL ?? "http://127.0.0.1:8000";

// Vercel 등 서버리스 timeout 보호 (개발은 무관)
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.product_query) {
    return NextResponse.json(
      { error: "product_query required" },
      { status: 400 }
    );
  }
  const res = await fetch(`${AI_WORKER}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_query: body.product_query,
      domain_slug: body.domain_slug ?? "cosmetics",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `ai-worker ${res.status}: ${text}` },
      { status: 502 }
    );
  }
  return NextResponse.json(await res.json());
}
