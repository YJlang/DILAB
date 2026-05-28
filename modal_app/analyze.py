"""DILAB Phase 2 — Modal serverless 분석 함수.

Cloudflare Worker `/api/analyze` 가 이 함수의 web endpoint 를 호출 →
`spawn()` 으로 비동기 트리거 → 즉시 응답 → 백그라운드에서 60~120초 처리.
ai-worker FastAPI 의 `analyze_product` 로직을 그대로 사용.

==== Deploy ====
1) Modal 가입: https://modal.com/signup
2) modal CLI 설치 + 토큰:
     pip install modal
     modal token new          # 브라우저 OAuth 로 인증

3) Secret 등록 (한 번만 — Modal 대시보드 또는 CLI):
     modal secret create dilab-env \
       SUPABASE_URL=https://mxofuzhfdthqpzhzctwd.supabase.co \
       SUPABASE_SERVICE_ROLE_KEY=<service_role 키> \
       DEEPSEEK_API_KEY=<DeepSeek 키> \
       DEEPSEEK_BASE_URL=https://api.deepseek.com \
       LLM_MODEL=deepseek-chat \
       NAVER_CLIENT_ID=<네이버 ID> \
       NAVER_CLIENT_SECRET=<네이버 secret> \
       EMBEDDING_MODEL_NAME=BAAI/bge-m3 \
       EMBEDDING_DIMENSION=1024 \
       ENVIRONMENT=production \
       LOG_LEVEL=info \
       MODAL_PROXY_TOKEN=<랜덤 32자 — Cloudflare 와 공유>

4) 배포:
     cd C:\\dilab
     modal deploy modal_app/analyze.py

5) 출력된 web endpoint URL (https://<user>--dilab-analyze-trigger.modal.run) 을
   prototype/wrangler.jsonc 의 vars.MODAL_TRIGGER_URL 로 등록.
   MODAL_PROXY_TOKEN 도 동일하게 secret 으로 등록 (npx wrangler secret put).
"""
from __future__ import annotations

import os
from typing import Any

import modal

app = modal.App("dilab-analyze")

# Modal 이미지 — ai-worker 의 의존성 그대로. add_local_dir 로 src/ 통째 mount.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "sentence-transformers>=3.0,<4",
        "bertopic>=0.16,<0.17",
        "umap-learn>=0.5",
        "hdbscan>=0.8.38",
        "scikit-learn>=1.5,<2",
        "supabase>=2.6",
        "openai>=1.50",
        "httpx>=0.27",
        "pydantic>=2.9,<3",
        "pydantic-settings>=2.5",
        "fastapi>=0.115",
    )
    .env(
        {
            "HF_HOME": "/cache/hf",
            "TRANSFORMERS_CACHE": "/cache/hf",
            "SENTENCE_TRANSFORMERS_HOME": "/cache/hf",
        }
    )
    .add_local_dir(
        local_path="./ai-worker/src",
        remote_path="/root/src",
    )
)

# BGE-M3 가중치 (~2GB) 캐싱 — 첫 호출 다운로드, 이후 즉시 mount.
model_volume = modal.Volume.from_name("dilab-models", create_if_missing=True)

SECRET = modal.Secret.from_name("dilab-env")


@app.function(
    image=image,
    cpu=1,
    memory=8192,
    volumes={"/cache": model_volume},
    timeout=900,
    secrets=[SECRET],
)
def analyze_product_task(job_id: str, product_query: str, domain_slug: str) -> None:
    """무거운 분석 — Cloudflare Worker 의 trigger 가 `.spawn()` 으로 호출.
    결과는 Supabase `analysis_jobs` 테이블에 갱신 → 클라이언트 polling 으로 픽업.
    """
    import sys
    import traceback

    sys.path.insert(0, "/root")

    from supabase import create_client

    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    def update(**fields: Any) -> None:
        sb.table("analysis_jobs").update(fields).eq("id", job_id).execute()

    try:
        update(
            status="running",
            progress={
                "step": 1,
                "of_steps": 3,
                "message": "분석 시작 — 네이버 수집 + BGE-M3 임베딩 + DeepSeek 라벨링 (약 60~120초)",
            },
        )

        from src.ingestion.auto_ingest import analyze_product  # type: ignore

        result = analyze_product(product_query, domain_slug=domain_slug)

        if "error" in result:
            update(status="error", error=str(result["error"])[:500])
            return

        update(
            status="done",
            result_slug=result["slug"],
            progress={
                "step": 3,
                "of_steps": 3,
                "message": (
                    f"완료 — {result.get('documents_added', 0)} documents · "
                    f"{result.get('elapsed_sec', 0)}초"
                ),
            },
        )
    except Exception as e:
        update(status="error", error=f"{type(e).__name__}: {e}"[:500])
        traceback.print_exc()
        raise


@app.function(
    image=image,
    cpu=0.5,
    memory=2048,
    secrets=[SECRET],
    timeout=60,
)
@modal.fastapi_endpoint(method="POST", docs=False)
def compare(body: dict[str, Any]) -> dict[str, Any]:
    """동기 비교 endpoint — Cloudflare /compare/[a]/[b] 에서 호출. ~5초 응답.

    Body: { _token, slug_a, slug_b, domain_slug? }
    """
    import sys
    from dataclasses import asdict

    if body.get("_token") != os.environ.get("MODAL_PROXY_TOKEN", ""):
        return {"error": "unauthorized"}

    slug_a = body.get("slug_a")
    slug_b = body.get("slug_b")
    if not slug_a or not slug_b:
        return {"error": "slug_a and slug_b required"}

    sys.path.insert(0, "/root")
    from src.compare import compare as _compare  # type: ignore

    result = _compare(body.get("domain_slug", "cosmetics"), slug_a, slug_b)
    return asdict(result)


@app.function(
    image=image,
    cpu=0.25,
    memory=512,
    secrets=[SECRET],
)
@modal.fastapi_endpoint(method="POST", docs=False)
def trigger(body: dict[str, Any]) -> dict[str, Any]:
    """Cloudflare Worker 가 호출하는 web endpoint. fire-and-forget — 즉시 응답.

    Body: {
      "_token": "<MODAL_PROXY_TOKEN>",        # 인증
      "job_id": "<uuid>",                     # Supabase analysis_jobs.id
      "product_query": "닥터지 레드 블레미쉬 크림",
      "domain_slug": "cosmetics"
    }
    """
    expected = os.environ.get("MODAL_PROXY_TOKEN", "")
    if not expected or body.get("_token") != expected:
        return {"ok": False, "error": "unauthorized"}

    job_id = body.get("job_id")
    product_query = body.get("product_query")
    domain_slug = body.get("domain_slug", "cosmetics")

    if not job_id or not product_query:
        return {"ok": False, "error": "job_id and product_query required"}

    analyze_product_task.spawn(job_id, product_query, domain_slug)
    return {"ok": True, "job_id": job_id}
