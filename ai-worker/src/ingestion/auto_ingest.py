"""제품 자동 분석 — fetch → ingest → label → ratings 5단계 묶음.

사용:
  from src.ingestion.auto_ingest import analyze_product
  result = analyze_product("닥터지 레드 블레미쉬 크림")
  # → {"product_id":..., "slug":..., "documents": 45, ...}
"""
from __future__ import annotations

import time
from typing import Any, cast

from ..analysis import label_domain
from ..config import settings
from ..db import supabase
from ..embeddings import embed_texts
from ..ratings import upsert_ratings
from .naver_fetcher import NaverClient
from .slug import build_slug

Row = dict[str, Any]


def _rows(r: Any) -> list[Row]:
    return cast(list[Row], r.data)


def _parse_postdate(s: str | None) -> str | None:
    if not s or len(s) != 8:
        return None
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def analyze_product(
    product_query: str,
    *,
    domain_slug: str = "cosmetics",
) -> Row:
    started = time.perf_counter()

    if not settings.naver_client_id or not settings.naver_client_secret:
        return {"error": "NAVER_CLIENT_ID/SECRET not configured"}

    naver = NaverClient(settings.naver_client_id, settings.naver_client_secret)

    # 1. fetch
    fetched = naver.fetch_product_data(product_query)
    if not fetched["reviews"]:
        return {"error": "no reviews found", "query": product_query}

    # 2. domain + product
    dom = cast(
        Row,
        supabase.table("domains")
        .select("id")
        .eq("slug", domain_slug)
        .single()
        .execute()
        .data,
    )
    domain_id = dom["id"]

    shop = fetched["shop"] or {}
    name = (shop.get("title") or product_query).strip()
    brand = shop.get("brand") or ""
    slug = build_slug(name, brand=brand)

    existing = _rows(
        supabase.table("products").select("id, metadata").eq("domain_id", domain_id).execute()
    )
    found = next(
        (p for p in existing if (p.get("metadata") or {}).get("slug") == slug),
        None,
    )
    if found:
        product_id = found["id"]
        new_product = False
    else:
        inserted = _rows(
            supabase.table("products")
            .insert(
                {
                    "domain_id": domain_id,
                    "name": name,
                    "brand": brand,
                    "category": shop.get("category3") or shop.get("category2"),
                    "metadata": {
                        "slug": slug,
                        "maker": shop.get("maker"),
                        "naver_catalog_id": shop.get("productId"),
                        "price_low_krw": shop.get("lprice"),
                        "fetched_at": time.strftime("%Y-%m-%d"),
                        "source": "naver-api-auto",
                        "query": product_query,
                    },
                }
            )
            .execute()
        )
        product_id = inserted[0]["id"]
        new_product = True

    # 3. documents + chunks
    doc_payloads: list[Row] = []
    for items, source_type in (
        (fetched["reviews"], "public_review"),
        (fetched["expert"], "expert"),
    ):
        for it in items:
            body = (it.get("description") or "").strip()
            if not body:
                continue
            doc_payloads.append(
                {
                    "domain_id": domain_id,
                    "product_id": product_id,
                    "source_type": source_type,
                    "source_url": it.get("link"),
                    "author": it.get("bloggername"),
                    "author_credibility": None,
                    "title": it.get("title"),
                    "body": body,
                    "language": "ko",
                    "published_date": _parse_postdate(it.get("postdate")),
                    "seed_data": False,
                    "metadata": {"source": "naver-api-auto", "product_slug": slug},
                }
            )

    inserted_docs: list[Row] = []
    if doc_payloads:
        inserted_docs = _rows(supabase.table("documents").insert(doc_payloads).execute())
        texts = [d["body"] for d in doc_payloads]
        vectors = embed_texts(texts)
        supabase.table("chunks").insert(
            [
                {
                    "document_id": row["id"],
                    "domain_id": domain_id,
                    "chunk_index": 0,
                    "text": doc["body"],
                    "token_count": len(doc["body"]),
                    "embedding": vec,
                }
                for row, doc, vec in zip(inserted_docs, doc_payloads, vectors, strict=True)
            ]
        ).execute()

    # 4. 라벨링 (도메인 전체 — 이미 라벨된 chunk 는 skip 됨)
    label_result = label_domain(domain_slug)

    # 5. ratings 갱신
    rating_result = upsert_ratings(product_id)

    return {
        "product_id": product_id,
        "slug": slug,
        "name": name,
        "brand": brand,
        "new_product": new_product,
        "documents_added": len(doc_payloads),
        "label": label_result,
        "ratings": rating_result,
        "elapsed_sec": int(time.perf_counter() - started),
    }
