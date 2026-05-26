# DILAB AI Worker

Python 기반 AI 워커 — DILAB MVP 의 B1~B5 (임베딩·토픽·분류·감성·여정·RAG) 담당. Supabase 는 상태, 본 워커는 연산.

## 빠른 시작

```powershell
cd ai-worker
Copy-Item .env.example .env   # SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY 채우기

# 가상환경 (uv 또는 venv)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# FastAPI 띄우기
uvicorn src.main:app --reload --port 8000

# 헬스 체크
curl http://localhost:8000/health
```

응답 예시 (Supabase 연결되면):

```json
{"ok": true, "supabase_connected": true, "domains": [{"slug":"cosmetics","name":"화장품"}]}
```

## 디렉토리

```
src/
├── main.py        FastAPI 진입점
├── config.py      Pydantic Settings (.env 자동 로드)
├── db/            Supabase client (service_role)
├── embeddings/    BGE-M3 (1024 dim) — B1
├── llm/           DeepSeek 클라이언트 (OpenAI 호환) — B3·B4·B5
├── ingestion/     문서 → 청크 → 임베딩 → 저장 (M2 구현)
├── topics/        BERTopic — B2 (M3)
├── analysis/      분류·감성·여정 — B3·B4 (M3)
├── rag/           DILAB Ask — B5 (M4)
└── ratings/       5축 평가 + evidence — ★1 (M4)
```

## 환경 변수

[`.env.example`](.env.example) 참조.

| 변수 | 어디서 |
|---|---|
| `SUPABASE_URL` | `https://mxofuzhfdthqpzhzctwd.supabase.co` (고정) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → **service_role secret** (절대 git 에 X) |
| `DEEPSEEK_API_KEY` | https://platform.deepseek.com (OpenAI 호환) |
| `LLM_MODEL` | `deepseek-chat` (기본), dashboard 표기 모델 ID 그대로 |

## 설계 원칙

- **stateless** — 모든 결과는 Supabase 로 다시 쓰기. 워커 재시작에도 안전
- **service_role 사용** — RLS 우회. anon/authenticated 권한으론 쓰기 불가
- **LangChain/LlamaIndex 미사용** — 의존성 최소 (supabase·sentence-transformers·anthropic·bertopic 4개)
- **모델 1회 로드** — `@lru_cache` 로 BGE-M3 프로세스당 한 번만

## 관련 문서

- [기술 스택 ADR](../docs/research/tech-stack-decision.md)
- [DB 스키마 / ERD](../docs/db/schema.md)
- [PRD](../docs/prd/dilab-mvp-prd.md)
