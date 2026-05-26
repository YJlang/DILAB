"""B5 — DILAB Ask: query → hybrid retrieve → DeepSeek 합성 → answer + recommendation + 출처.

Phase 1: 결과 in-memory 반환 + (옵션) Supabase 의 ask_queries/responses/citations 영속화.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, cast

from ..config import settings
from ..db import supabase
from ..embeddings import embed_one
from ..llm import chat

Row = dict[str, Any]


@dataclass
class Citation:
    rank: int
    chunk_id: str
    cite_type: str  # 'expert' | 'public'
    author: str | None
    author_credibility: int | None
    text: str
    similarity: float


@dataclass
class Answer:
    query: str
    answer: str
    recommendation: str
    citations: list[Citation]
    llm_model: str
    latency_ms: int
    expert_count: int
    public_count: int
    product_id: str | None = None
    query_id: str | None = None  # Supabase 저장 시 채워짐
    response_id: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


SYSTEM_PROMPT = """\
당신은 화장품 도메인 RAG 어시스턴트 DILAB Ask 입니다.
사용자 질문과 함께 제공된 [출처] 청크만 사용해 *근거 있는* 답변을 생성하세요.

규칙:
- [출처] 에 없는 내용을 만들지 마세요. 모르는 부분은 "제공된 자료로는 단정하기 어려워요" 같이 정직하게.
- [Expert] 출처를 우선 활용, [User] 출처는 보조로 — 단 [User] 만 다루는 정보(예: 향, 사용감)는 그대로 활용해도 OK.
- 답변 본문 안에서 [1], [2] 같이 출처 번호를 인용.
- 친근한 톤 ("~해요", "~할 수 있어요").
- 한국어로만 답변.

반드시 다음 JSON 만 출력 (다른 텍스트·코드블록 X):
{"answer":"3~5문장 답변, 출처 [n] 인용 포함","recommendation":"한 줄 추천 — 어떤 사람에게 적합/비적합한지"}
"""


def _rows(execute_result: Any) -> list[Row]:
    return cast(list[Row], execute_result.data)


def _resolve_product_id(domain_id: str, product_slug: str) -> str:
    rows = _rows(
        supabase.table("products").select("id, metadata").eq("domain_id", domain_id).execute()
    )
    for row in rows:
        if (row.get("metadata") or {}).get("slug") == product_slug:
            return row["id"]
    raise ValueError(f"product slug not found: {product_slug}")


def _retrieve(
    qv: list[float],
    domain_id: str,
    product_id: str | None,
    *,
    source_type: str | None,
    k: int,
    prefer_expert: bool = False,
) -> list[Row]:
    return _rows(
        supabase.rpc(
            "match_chunks",
            {
                "query_embedding": qv,
                "match_domain_id": domain_id,
                "match_product_id": product_id,
                "match_source_type": source_type,
                "match_count": k,
                "prefer_expert": prefer_expert,
            },
        ).execute()
    )


def _format_chunks(rows: list[Row]) -> tuple[str, list[Citation]]:
    parts: list[str] = []
    citations: list[Citation] = []
    for i, row in enumerate(rows, 1):
        is_expert = row["source_type"] == "expert"
        tag = "Expert" if is_expert else "User"
        cred = row.get("author_credibility")
        cred_note = f", 신뢰도 {cred}/10" if cred else ""
        author = row.get("author") or "익명"
        parts.append(f"[{i}] [{tag}] {author}{cred_note}\n{row['text']}")
        citations.append(
            Citation(
                rank=i,
                chunk_id=row["chunk_id"],
                cite_type="expert" if is_expert else "public",
                author=author,
                author_credibility=cred,
                text=row["text"],
                similarity=row["similarity"],
            )
        )
    return "\n\n".join(parts), citations


def _parse_json_answer(raw: str) -> tuple[str, str]:
    text = raw.strip()
    if text.startswith("```"):
        chunks = text.split("```", 2)
        text = chunks[1] if len(chunks) > 1 else raw
        if text.startswith("json"):
            text = text[4:].lstrip()
        text = text.rsplit("```", 1)[0].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            obj = json.loads(text[start : end + 1])
            return str(obj.get("answer", raw)), str(obj.get("recommendation", ""))
        except json.JSONDecodeError:
            pass
    return raw, ""


def _persist(
    *,
    user_id: str | None,
    domain_id: str,
    product_id: str | None,
    query: str,
    answer_text: str,
    recommendation: str,
    citations: list[Citation],
    llm_model: str,
    latency_ms: int,
) -> tuple[str, str]:
    """ask_queries + ask_responses + citations 저장. (query_id, response_id) 반환."""
    qrow = _rows(
        supabase.table("ask_queries")
        .insert(
            {
                "user_id": user_id,
                "domain_id": domain_id,
                "product_id": product_id,
                "query": query,
            }
        )
        .execute()
    )[0]
    query_id = qrow["id"]

    rrow = _rows(
        supabase.table("ask_responses")
        .insert(
            {
                "query_id": query_id,
                "answer": answer_text,
                "recommendation": recommendation,
                "llm_model": llm_model,
                "latency_ms": latency_ms,
            }
        )
        .execute()
    )[0]
    response_id = rrow["id"]

    if citations:
        supabase.table("citations").insert(
            [
                {
                    "response_id": response_id,
                    "chunk_id": c.chunk_id,
                    "cite_type": c.cite_type,
                    "rank": c.rank,
                }
                for c in citations
            ]
        ).execute()
    return query_id, response_id


def answer(
    query: str,
    *,
    domain_slug: str = "cosmetics",
    product_slug: str | None = None,
    expert_k: int = 3,
    public_k: int = 3,
    persist: bool = False,
    user_id: str | None = None,
) -> Answer:
    """Hybrid retrieval: expert_k + public_k 분리 호출 후 합치기.

    expert_k=0 또는 public_k=0 이면 한 쪽만. (기존 동작 유지 위해 prefer_expert 패턴은 RPC 인자로 남음)
    """
    dom = cast(
        Row,
        supabase.table("domains").select("id").eq("slug", domain_slug).single().execute().data,
    )
    domain_id = dom["id"]
    product_id = _resolve_product_id(domain_id, product_slug) if product_slug else None

    qv = embed_one(query)

    retrieved: list[Row] = []
    if expert_k > 0:
        retrieved += _retrieve(qv, domain_id, product_id, source_type="expert", k=expert_k)
    if public_k > 0:
        retrieved += _retrieve(qv, domain_id, product_id, source_type="public_review", k=public_k)

    chunks_block, citations = _format_chunks(retrieved)
    user_prompt = f"[질문]\n{query}\n\n[출처]\n{chunks_block}"

    start = time.perf_counter()
    raw = chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=800,
    )
    latency_ms = int((time.perf_counter() - start) * 1000)
    ans, rec = _parse_json_answer(raw)

    result = Answer(
        query=query,
        answer=ans,
        recommendation=rec,
        citations=citations,
        llm_model=settings.llm_model,
        latency_ms=latency_ms,
        expert_count=sum(1 for c in citations if c.cite_type == "expert"),
        public_count=sum(1 for c in citations if c.cite_type == "public"),
        product_id=product_id,
        raw={"prompt_chars": len(user_prompt), "raw_llm": raw[:500]},
    )

    if persist:
        qid, rid = _persist(
            user_id=user_id,
            domain_id=domain_id,
            product_id=product_id,
            query=query,
            answer_text=ans,
            recommendation=rec,
            citations=citations,
            llm_model=settings.llm_model,
            latency_ms=latency_ms,
        )
        result.query_id = qid
        result.response_id = rid

    return result
