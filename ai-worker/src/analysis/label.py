"""B3 + B4 통합 라벨러 — DeepSeek 단일 호출로 청크당 categories + sentiment + journey 라벨링.

도메인 정의(categories, journey_stages JSONB) 를 system/user prompt 에 주입 → 도메인-플렉시블.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any, cast

from ..config import settings
from ..db import supabase
from ..llm import chat

Row = dict[str, Any]


SYSTEM_PROMPT = """\
당신은 화장품 도메인 텍스트 라벨러입니다.
청크 텍스트를 읽고 다음 세 가지를 라벨링하세요:

1. categories: 도메인 정의 카테고리 중 텍스트가 다루는 것을 0~3개 선택 (해당 없으면 빈 배열)
2. sentiment: positive | neutral | negative 중 하나 + intensity 0~1
3. journey: 사용자 여정 단계 중 가장 잘 맞는 1개

반드시 다음 JSON 만 출력 (다른 텍스트·코드블록 X):
{
  "categories": [{"category": "<도메인 카테고리>", "confidence": 0.0-1.0}, ...],
  "sentiment": {"label": "positive|neutral|negative", "intensity": 0.0-1.0},
  "journey": {"stage_key": "<도메인 stage key>", "confidence": 0.0-1.0}
}

규칙:
- categories 의 category 는 도메인 정의 카테고리 문자열 그대로.
- 짧은 텍스트(<50자)나 모호하면 confidence 낮춰 (0.5 미만은 빈 배열 권장).
- sentiment 는 텍스트 톤 전체. 단순 사실 서술은 neutral.
- journey stage_key 는 도메인 정의 key 중 하나 그대로.
"""


def _build_user_prompt(text: str, categories: list[str], journey_stages: list[Row]) -> str:
    stages_desc = ", ".join(f'{s["key"]}({s.get("label","")})' for s in journey_stages)
    return f"""\
[도메인 정의]
categories: {", ".join(categories)}
journey_stages: {stages_desc}

[청크]
{text}
"""


@dataclass
class ChunkLabels:
    chunk_id: str
    categories: list[tuple[str, float]]
    sentiment_label: str
    sentiment_intensity: float
    journey_stage: str
    journey_confidence: float


def _parse_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```", 2)
        text = parts[1] if len(parts) > 1 else raw
        if text.startswith("json"):
            text = text[4:].lstrip()
        text = text.rsplit("```", 1)[0].strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        return cast(dict[str, Any], json.loads(text[start : end + 1]))
    except json.JSONDecodeError:
        return {}


def label_chunk(chunk_id: str, text: str, domain_meta: dict[str, Any]) -> ChunkLabels:
    user_prompt = _build_user_prompt(
        text=text,
        categories=domain_meta.get("categories", []),
        journey_stages=domain_meta.get("journey_stages", []),
    )
    raw = chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.0,
        max_tokens=300,
    )
    obj = _parse_json(raw)
    cats = obj.get("categories", []) or []
    sent = obj.get("sentiment", {}) or {}
    jou = obj.get("journey", {}) or {}

    return ChunkLabels(
        chunk_id=chunk_id,
        categories=[
            (c["category"], float(c.get("confidence", 0.5)))
            for c in cats
            if isinstance(c, dict) and c.get("category")
        ],
        sentiment_label=str(sent.get("label") or "neutral"),
        sentiment_intensity=float(sent.get("intensity", 0.5)),
        journey_stage=str(jou.get("stage_key") or "use"),
        journey_confidence=float(jou.get("confidence", 0.5)),
    )


def _rows(execute_result: Any) -> list[Row]:
    return cast(list[Row], execute_result.data)


def label_domain(domain_slug: str, *, limit: int | None = None) -> dict[str, Any]:
    """도메인 전체 chunks 라벨링 → classifications + sentiments + journey_assignments insert.

    이미 라벨된 chunk (sentiments 에 행 있음) 는 skip.
    """
    dom = cast(
        Row,
        supabase.table("domains")
        .select("id, categories, journey_stages")
        .eq("slug", domain_slug)
        .single()
        .execute()
        .data,
    )
    domain_id = dom["id"]
    domain_meta = {
        "categories": dom.get("categories") or [],
        "journey_stages": dom.get("journey_stages") or [],
    }

    labeled_ids = {
        r["chunk_id"]
        for r in _rows(supabase.table("sentiments").select("chunk_id").execute())
    }
    chunks = _rows(
        supabase.table("chunks")
        .select("id, text, document_id")
        .eq("domain_id", domain_id)
        .execute()
    )
    chunks = [c for c in chunks if c["id"] not in labeled_ids]
    if limit:
        chunks = chunks[:limit]
    if not chunks:
        return {"labeled": 0, "note": "no unlabeled chunks"}

    doc_ids = list({c["document_id"] for c in chunks})
    docs = _rows(
        supabase.table("documents").select("id, product_id").in_("id", doc_ids).execute()
    )
    product_map = {d["id"]: d.get("product_id") for d in docs}

    cls_rows: list[Row] = []
    sent_rows: list[Row] = []
    jou_rows: list[Row] = []
    failed = 0
    started = time.perf_counter()

    for i, ch in enumerate(chunks, 1):
        try:
            lbl = label_chunk(ch["id"], ch["text"], domain_meta)
        except Exception as e:  # noqa: BLE001
            print(f"  [{i}/{len(chunks)}] FAIL: {e}")
            failed += 1
            continue
        print(
            f"  [{i}/{len(chunks)}] {lbl.sentiment_label:8} {lbl.journey_stage:8} "
            f"cats={[c[0] for c in lbl.categories]}"
        )
        for cat, conf in lbl.categories:
            cls_rows.append(
                {
                    "chunk_id": ch["id"],
                    "category": cat,
                    "confidence": conf,
                    "assigned_by": settings.llm_model,
                }
            )
        sent_rows.append(
            {
                "chunk_id": ch["id"],
                "sentiment": lbl.sentiment_label,
                "intensity": lbl.sentiment_intensity,
                "assigned_by": settings.llm_model,
            }
        )
        product_id = product_map.get(ch["document_id"])
        if product_id:
            jou_rows.append(
                {
                    "chunk_id": ch["id"],
                    "product_id": product_id,
                    "stage_key": lbl.journey_stage,
                    "confidence": lbl.journey_confidence,
                    "is_estimated": True,
                    "assigned_by": settings.llm_model,
                }
            )

    if cls_rows:
        supabase.table("classifications").insert(cls_rows).execute()
    if sent_rows:
        supabase.table("sentiments").insert(sent_rows).execute()
    if jou_rows:
        supabase.table("journey_assignments").insert(jou_rows).execute()

    return {
        "labeled": len(chunks) - failed,
        "failed": failed,
        "classifications": len(cls_rows),
        "sentiments": len(sent_rows),
        "journey": len(jou_rows),
        "elapsed_sec": int(time.perf_counter() - started),
    }
