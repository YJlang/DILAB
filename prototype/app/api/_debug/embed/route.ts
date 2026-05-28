/**
 * 임시 — BGE-M3 차원 검증용. 첫 배포 후 한 번 GET 호출 → length 확인 →
 * 1024 이면 Phase 1 통과. 확인 후 이 route 는 제거.
 */
import { NextResponse } from "next/server";
import { embedQuery } from "@/lib/embeddings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const vec = await embedQuery("테스트 문장");
    return NextResponse.json({
      length: vec.length,
      sample: vec.slice(0, 5),
      ok: vec.length === 1024,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
