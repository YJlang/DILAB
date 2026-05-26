"""5축 평가 점수 계산 — product 단위.

점수 공식: 해당 axis 의 청크들의 *부호 있는 감성 강도* 가중 평균 → [0, 10] 스케일
  signed = +intensity (positive) / -intensity (negative) / 0 (neutral)
  weighted = signed * classification_confidence
  axis_score = ((mean(weighted) + 1) / 2) * 10

evidence_chunk_ids: classification_confidence 상위 5개 청크 ID (★1 hover 근거).
"""
from __future__ import annotations

import time
from typing import Any, cast

from ..config import settings
from ..db import supabase

Row = dict[str, Any]


def _rows(res: Any) -> list[Row]:
    return cast(list[Row], res.data)


def compute_product_ratings(product_id: str, *, top_evidence: int = 5) -> list[Row]:
    # 1) product 가 속한 도메인 + axes 정의
    prod = cast(
        Row,
        supabase.table("products")
        .select("domain_id")
        .eq("id", product_id)
        .single()
        .execute()
        .data,
    )
    domain_id = prod["domain_id"]
    dom = cast(
        Row,
        supabase.table("domains")
        .select("rating_axes")
        .eq("id", domain_id)
        .single()
        .execute()
        .data,
    )
    axes: list[str] = dom.get("rating_axes") or []

    # 2) product 의 documents → chunks
    docs = _rows(
        supabase.table("documents").select("id").eq("product_id", product_id).execute()
    )
    if not docs:
        return []
    doc_ids = [d["id"] for d in docs]
    chunks = _rows(
        supabase.table("chunks").select("id").in_("document_id", doc_ids).execute()
    )
    chunk_ids = [c["id"] for c in chunks]
    if not chunk_ids:
        return []

    # 3) classifications + sentiments
    cls = _rows(
        supabase.table("classifications")
        .select("chunk_id, category, confidence")
        .in_("chunk_id", chunk_ids)
        .execute()
    )
    sent_rows = _rows(
        supabase.table("sentiments")
        .select("chunk_id, sentiment, intensity")
        .in_("chunk_id", chunk_ids)
        .execute()
    )
    sent_map = {s["chunk_id"]: s for s in sent_rows}

    # 4) axis 별 집계
    out: list[Row] = []
    for axis in axes:
        axis_cls = [c for c in cls if c["category"] == axis]
        if not axis_cls:
            out.append(
                {
                    "product_id": product_id,
                    "axis": axis,
                    "score": None,  # 데이터 없음
                    "evidence_chunk_ids": [],
                    "generated_by": settings.llm_model,
                    "n_chunks": 0,
                }
            )
            continue

        scored: list[tuple[str, float, float]] = []  # (chunk_id, weighted_signed, cls_conf)
        for c in axis_cls:
            s = sent_map.get(c["chunk_id"])
            if not s:
                continue
            label = s["sentiment"]
            intensity = float(s.get("intensity") or 0)
            signed = (
                intensity if label == "positive" else (-intensity if label == "negative" else 0)
            )
            weighted = signed * float(c.get("confidence") or 0.5)
            scored.append((c["chunk_id"], weighted, float(c.get("confidence") or 0.5)))

        if not scored:
            continue
        avg = sum(w for _, w, _ in scored) / len(scored)
        score = round(((avg + 1) / 2) * 10, 1)
        evidence = [cid for cid, _, _ in sorted(scored, key=lambda x: -x[2])[:top_evidence]]
        out.append(
            {
                "product_id": product_id,
                "axis": axis,
                "score": score,
                "evidence_chunk_ids": evidence,
                "generated_by": settings.llm_model,
                "n_chunks": len(scored),
            }
        )
    return out


def upsert_ratings(product_id: str, *, top_evidence: int = 5) -> dict[str, Any]:
    """기존 rating 행 삭제 후 새로 insert (generated_at unique 회피)."""
    payload = compute_product_ratings(product_id, top_evidence=top_evidence)
    # n_chunks 는 DB 컬럼 아니라 분리
    db_payload = [
        {
            k: v
            for k, v in p.items()
            if k in {"product_id", "axis", "score", "evidence_chunk_ids", "generated_by"}
            and v is not None
        }
        for p in payload
        if p["score"] is not None
    ]
    if not db_payload:
        return {"product_id": product_id, "ratings": 0, "note": "no labels yet"}

    supabase.table("ratings").delete().eq("product_id", product_id).execute()
    inserted = _rows(supabase.table("ratings").insert(db_payload).execute())
    return {
        "product_id": product_id,
        "ratings": len(inserted),
        "detail": [
            {"axis": p["axis"], "score": p["score"], "n_chunks": p["n_chunks"]} for p in payload
        ],
    }
