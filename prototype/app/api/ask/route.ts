/**
 * DILAB Ask API — Next.js → ai-worker FastAPI 호출 프록시.
 * ai-worker 가 /api/ask 엔드포인트를 노출하면 그쪽으로 forward.
 * 현재는 ai-worker 가 아직 endpoint 추가 X — 임시로 ai-worker 직접 호출 형식.
 *
 * TODO: ai-worker FastAPI 에 POST /ask 라우트 추가 후 단순 fetch 로 전환.
 */
import { NextResponse } from "next/server";

const AI_WORKER = process.env.AI_WORKER_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${AI_WORKER}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: body.query,
      domain_slug: body.domain ?? "cosmetics",
      product_slug: body.product ?? null,
      expert_k: 3,
      public_k: 3,
      persist: true,
    }),
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `ai-worker ${res.status}` },
      { status: 502 }
    );
  }
  return NextResponse.json(await res.json());
}
