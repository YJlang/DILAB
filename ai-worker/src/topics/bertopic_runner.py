"""B2 BERTopic — domain 의 chunks 를 클러스터링하고 topics + topic_assignments 저장.

작은 데이터셋 (≤100 chunks) 대응:
- UMAP n_neighbors 10 (default 15 보다 작게)
- HDBSCAN min_cluster_size 3 (default 10 보다 작게)
- BGE-M3 embedding 은 이미 캐시된 모델 재사용
"""
from __future__ import annotations

import time
from typing import Any, cast

from bertopic import BERTopic
from hdbscan import HDBSCAN
from umap import UMAP

from ..db import supabase
from ..embeddings import get_model

Row = dict[str, Any]


def _rows(r: Any) -> list[Row]:
    return cast(list[Row], r.data)


def run_bertopic(domain_slug: str, *, min_topic_size: int = 3) -> dict[str, Any]:
    dom = cast(
        Row,
        supabase.table("domains").select("id").eq("slug", domain_slug).single().execute().data,
    )
    domain_id = dom["id"]

    chunks = _rows(
        supabase.table("chunks").select("id, text").eq("domain_id", domain_id).execute()
    )
    if len(chunks) < min_topic_size * 2:
        return {"error": f"too few chunks ({len(chunks)})"}

    texts = [c["text"] for c in chunks]
    chunk_ids = [c["id"] for c in chunks]

    sbert = get_model()
    umap_model = UMAP(
        n_neighbors=min(10, max(2, len(texts) - 1)),
        n_components=3,
        min_dist=0.0,
        metric="cosine",
        random_state=42,
    )
    hdbscan_model = HDBSCAN(
        min_cluster_size=min_topic_size,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )
    model = BERTopic(
        embedding_model=sbert,
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        min_topic_size=min_topic_size,
        calculate_probabilities=False,
        verbose=False,
    )

    start = time.perf_counter()
    topic_indices, _ = model.fit_transform(texts)
    elapsed = int(time.perf_counter() - start)

    # 기존 클러스터 정리 (domain 단위)
    supabase.table("topic_assignments").delete().in_("chunk_id", chunk_ids).execute()
    supabase.table("topics").delete().eq("domain_id", domain_id).execute()

    info = model.get_topic_info()
    topic_rows: list[Row] = []
    for _, r in info.iterrows():
        ti = int(r["Topic"])
        keywords: list[str] = []
        if ti != -1:
            topic_kw = model.get_topic(ti)
            if topic_kw:
                keywords = [w for w, _ in topic_kw][:6]
        topic_rows.append(
            {
                "domain_id": domain_id,
                "topic_index": ti,
                "label": str(r.get("Name", f"Topic {ti}"))[:200],
                "keywords": keywords,
                "doc_count": int(r.get("Count", 0)),
            }
        )
    inserted = _rows(supabase.table("topics").insert(topic_rows).execute())
    id_map = {t["topic_index"]: t["id"] for t in inserted}

    assignments = [
        {"chunk_id": cid, "topic_id": id_map[int(ti)], "probability": None}
        for cid, ti in zip(chunk_ids, topic_indices, strict=True)
        if int(ti) in id_map
    ]
    if assignments:
        supabase.table("topic_assignments").insert(assignments).execute()

    return {
        "chunks": len(chunks),
        "topics": len(topic_rows),
        "outlier_count": next(
            (int(r["Count"]) for _, r in info.iterrows() if int(r["Topic"]) == -1), 0
        ),
        "topic_summary": [
            {
                "idx": tr["topic_index"],
                "label": tr["label"],
                "kw": tr["keywords"][:5],
                "n": tr["doc_count"],
            }
            for tr in topic_rows
        ],
        "elapsed_sec": elapsed,
    }
