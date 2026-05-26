# Agent Handoff — DILAB MVP

> 다른 환경 / 다른 세션의 **AI agent** (Claude Code 등) 가 즉시 이 프로젝트를 이어받을 수 있도록 작성한 인수인계 문서. **사람이 보기 좋게 작성하지 않았음** — agent 가 *최단 시간에 컨텍스트 복구* 하는 게 목적.

- **AS_OF**: 2026-05-27
- **상태**: 풀스택 MVP 가동. S1~S6 화면 + 자동 분석 파이프라인 + Supabase 영속화 완성.
- **저장소**: `https://github.com/YJlang/DILAB` (main 브랜치)

---

## 1. 30초 컨텍스트

DILAB = 한국어 화장품 도메인 *전문가 리뷰 + 일반 리뷰* 를 BGE-M3 임베딩으로 인덱싱, BERTopic 토픽 분리, DeepSeek 으로 분류·감성·여정 라벨링, RAG 로 자연어 질문에 *출처 카드 포함* 답변 생성하는 도메인-플렉시블 SaaS 프로토타입.

차별화 2축:
- **★1 출처 카드 (`citations` 테이블 + `ratings.evidence_chunk_ids[]`)** — 모든 답변·점수가 *어느 청크에서 나왔는지* 추적 가능
- **★2 도메인-플렉시블 (`domains` JSONB 컬럼 + denormalized `chunks.domain_id`)** — 새 도메인 추가 = SQL 1줄 + 코퍼스 업로드

---

## 2. 3 컴포넌트

```
prototype/        Next.js 16 + React 19 + Tailwind 4 + Recharts
                  http://localhost:3000
                  - app/        : S0(/) S1(/products/[slug]) S2(/ask) S3(/topics)
                                  S4(/journey/[slug]) S5(/dashboard) S6(/compare/[a]/[b])
                  - components/ : RadarChart, CompareRadar, AskBox, AskFullPage,
                                  CitationCard, SentimentBars, TopicChips,
                                  JourneyMap, AnalyzeForm, InsightsPanel, CompareSelector
                  - lib/        : supabase client + data fetchers + types
                  - app/api/    : /api/ask, /api/analyze (Next → ai-worker proxy)

ai-worker/        Python 3.13 + FastAPI + uvicorn
                  http://127.0.0.1:8000
                  - src/main.py             : FastAPI app — /, /health, /ask, /analyze, /compare
                  - src/config.py           : Pydantic Settings (.env 자동 로드)
                  - src/db/                 : Supabase service_role client
                  - src/embeddings/         : BGE-M3 (sentence-transformers, lru_cache)
                  - src/llm/                : DeepSeek (OpenAI 호환 SDK, base_url=api.deepseek.com)
                  - src/ingestion/          : seed_loader, naver_loader, naver_fetcher,
                                              naver_pipeline, auto_ingest, slug, chunking
                  - src/analysis/           : label_domain (분류 + 감성 + 여정 동시 호출)
                  - src/topics/             : BERTopic runner (UMAP n_neighbors=10 + HDBSCAN size=3)
                  - src/ratings/            : compute_product_ratings (5축 evidence_chunk_ids)
                  - src/rag/                : answer (hybrid retrieve + DeepSeek 합성 + JSON 파싱)
                  - src/compare/            : compare (snapshot + diff + DeepSeek 마케팅 인사이트)
                  - scripts/                : ingest_seed, ingest_naver, label_chunks,
                                              compute_ratings, run_topics, ask, verify_rag

Supabase          mxofuzhfdthqpzhzctwd.supabase.co (한국 region)
                  - 15 테이블 (domains, products, documents, chunks, topics, ...)
                  - 16 RLS 정책 (advisor-corrected, auth.uid() → (select auth.uid()))
                  - pgvector extension (extensions schema)
                  - HNSW index on chunks.embedding
                  - RPC: match_chunks(query_embedding, match_domain_id, match_product_id,
                                       match_source_type, match_count, prefer_expert)
                  - 마이그레이션 이력: dilab_initial_setup, dilab_advisor_fixes,
                                       dilab_match_chunks_product_filter,
                                       dilab_match_chunks_v3_and_user_nullable
```

데이터 흐름 — 자동 분석 1 cycle (1분):
```
사용자 입력 "닥터지 레드 블레미쉬 크림"
  ↓ /api/analyze (Next.js)
  ↓ /analyze (ai-worker)
  ├── NaverClient.fetch_product_data → reviews 30 + expert 15 + shop 메타
  ├── build_slug → "drg-red-blemish-..." (BRAND_MAP + KEYWORD_MAP + hangul-romanize)
  ├── products upsert + documents insert (45 rows)
  ├── BGE-M3 embed_texts → chunks insert (45 vectors)
  ├── label_domain → DeepSeek 호출 45회 (분류·감성·여정 JSON)
  └── upsert_ratings → 5축 점수 + evidence_chunk_ids
  ↓
/products/<slug> redirect
```

---

## 3. 부팅 (새 환경 가정)

```powershell
# 1) 저장소
git clone https://github.com/YJlang/DILAB.git C:\DILAB
cd C:\DILAB

# 2) Supabase MCP 인증 (project scope)
#    .mcp.json 에 supabase 서버 등록되어 있음. Claude Code 안에서:
#    /mcp → supabase → Authenticate
#    또는 MCP 도구 mcp__supabase__authenticate 호출 → OAuth URL → 브라우저
#    인증 후 mcp__supabase__complete_authentication 으로 callback URL 전달

# 3) ai-worker
cd C:\DILAB\ai-worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
# .env 작성 (.env.example 복사)
Copy-Item .env.example .env
#   → SUPABASE_SERVICE_ROLE_KEY (dashboard → API → service_role)
#   → DEEPSEEK_API_KEY          (platform.deepseek.com)
#   → NAVER_CLIENT_ID/SECRET    (developers.naver.com)
uvicorn src.main:app --host 127.0.0.1 --port 8000

# 4) Next.js (다른 터미널)
cd C:\DILAB\prototype
# .env.local 작성 (sb_publishable_... 키만 — service_role 절대 X)
#   NEXT_PUBLIC_SUPABASE_URL=https://mxofuzhfdthqpzhzctwd.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
#   NEXT_PUBLIC_AI_WORKER_URL=http://127.0.0.1:8000
npm install
npm run dev
```

---

## 4. 환경 변수 체크리스트

| 변수 | 위치 | 어디서 |
|---|---|---|
| `SUPABASE_URL` | `ai-worker/.env` | 고정 `https://mxofuzhfdthqpzhzctwd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `ai-worker/.env` | Dashboard → Settings → API → service_role (절대 브라우저 X) |
| `DEEPSEEK_API_KEY` | `ai-worker/.env` | platform.deepseek.com |
| `DEEPSEEK_BASE_URL` | `ai-worker/.env` | `https://api.deepseek.com` (OpenAI 호환) |
| `LLM_MODEL` | `ai-worker/.env` | `deepseek-chat` (V3) 기본 |
| `NAVER_CLIENT_ID/SECRET` | `ai-worker/.env` | developers.naver.com → 검색 + 데이터랩 API |
| `EMBEDDING_MODEL_NAME` | `ai-worker/.env` | `BAAI/bge-m3` (1024 dim) |
| `NEXT_PUBLIC_SUPABASE_URL` | `prototype/.env.local` | 같은 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `prototype/.env.local` | `sb_publishable_...` (modern format, 브라우저 OK) |
| `NEXT_PUBLIC_AI_WORKER_URL` | `prototype/.env.local` | `http://127.0.0.1:8000` (개발) |

⚠️ `service_role` 키는 *서버 사이드만*. 클라이언트(Next.js public env) 에 넣으면 RLS 우회 가능 → 절대 X.

---

## 5. 필요 MCP 서버 + 스킬

### MCP 서버 (`~/.claude.json` user scope 또는 `.mcp.json` project scope)

| 서버 | scope | 용도 |
|---|---|---|
| `supabase` | project (`.mcp.json`) | DB 마이그레이션·RPC·테이블 조회. 인증 OAuth |
| `naver-search` | user | `NAVER_CLIENT_ID/SECRET` 필요. 새 제품 검색 시 |
| `exa` | user | 글로벌 시맨틱 웹 검색 |
| `playwright` | user | UI 검증 + 화면 캡쳐 |
| `skillsmp` | user | 스킬 검색 (설치는 CLI 사용) |

### 글로벌 스킬 (`~/.claude/skills/`)

| 스킬 | 트리거 | 용도 |
|---|---|---|
| `deep-research` | "조사", "리서치 보고서" | V6 인용 레지스트리 + counter-review |
| `benchmarking` | "벤치마킹", "갭 분석" | Competitive Profile Matrix |
| `product-management-workflows` | "PRD", "로드맵" | 단 사용자는 *기술 톤* 선호 — [[feedback_pm_business_depth]] 참조 |
| `supabase`, `supabase-expert`, `supabase-postgres-best-practices` | Supabase 작업 | Postgres + RLS + Edge Functions |
| `rag-pipelines` | "RAG", "벡터 검색" | 청킹·임베딩·하이브리드·평가 |
| `fastapi-modern-web-development` | "FastAPI", "Python API" | async + Pydantic v2 + ML 엔드포인트 |
| `sentence-transformers` | "임베딩", "BGE-M3" | 멀티링구얼 임베딩 |
| `frontend-prototype`, `shadcn-ui`, `d3-visualization`, `data-visualizer`, `ui-mockup` | UI 작업 | Next.js + Tailwind + 차트 |

⚠️ **`skillsmp_install_skill` MCP 도구는 deprecated `add-skill` 호출로 항상 실패**. 검색은 OK. 설치는 `npx -y skills add "<github-tree-url>"` CLI 사용. 자세한 함정: [[feedback_skillsmp_install]] 메모리.

---

## 6. 현재 데이터 (Supabase)

| 테이블 | 행 수 (2026-05-27 기준) | 비고 |
|---|---|---|
| `domains` | 1 | cosmetics |
| `products` | 2 | 아누아 (`anua-heartleaf-77`) + 닥터지 (`70ml-1-d5609967`) |
| `documents` | 83 | expert 15 + public_review 60 + seed 1 (legacy slug 7 잔재 X — 정리됨) |
| `chunks` | 87 | 모두 BGE-M3 1024d 임베딩 |
| `classifications` | ~180 | DeepSeek 라벨 |
| `sentiments` | 87 | chunk 당 1 |
| `journey_assignments` | ~80 | product_id 있는 chunks 만 |
| `topics` | 2 | "어성초/77/아누아/토너" + "세정력/자극도/메이크업/비건" |
| `topic_assignments` | 87 | outlier 0 |
| `ratings` | 10 | 2 제품 × 5축 |
| `ask_queries` + `ask_responses` + `citations` | 일부 | 데모 시 누적 |

⚠️ **닥터지 slug = `70ml-1-d5609967`** 는 *예전 알고리즘* 으로 생성. 새 build_slug 는 `drg-red-blemish-...` 형식이지만 *이미 저장된 것* 은 갱신 안 됨. 갱신은 SQL 1줄로 가능 ([CLAUDE.md](../CLAUDE.md) 4단계 표 외부 공유 직전에 권장).

---

## 7. 진행한 마일스톤

| M | 작업 | 산출물 |
|---|---|---|
| M0 | 벤치마킹 + PRD + 디자인 와이어프레임 | `benchmark/`, `docs/prd/`, `docs/design/` |
| M1 | 기술 스택 ADR + ERD + Supabase 초기화 | `docs/research/tech-stack-decision.md`, `docs/db/schema.md`, 2 migrations |
| M2 | B1 데이터 파이프라인 — seed + naver 수동 인제스션 + match_chunks RPC | `src/ingestion/*` |
| M3 | B2 BERTopic + B3 분류·감성 + B4 여정 매핑 + B5 RAG + 5축 ratings | `src/topics`, `src/analysis`, `src/rag`, `src/ratings` |
| M4 | 자동 분석 (`/analyze`) + S6 비교 (`/compare`) + S1~S6 풀 UI + slug 개선 | `prototype/app/*`, `prototype/components/*` |

---

## 8. 다음 작업 후보 (우선순위 추천 순)

1. **데이터 확장** — 3~5 제품 더 자동 분석 (S5/S6 의미 ↑, BERTopic 토픽 세분화)
2. **slug 갱신** — 옛 `70ml-1-d5609967` → `drg-red-blemish-...` (SQL 1줄)
3. **두 번째 도메인** — F&B 또는 가전. `domains` JSONB 한 줄 추가 → 모든 화면 자동 따라옴 (★2 입증)
4. **비동기 분석 + SSE 진행률** — 1분 동기 → 백그라운드 + 클라이언트 polling
5. **인증** — Supabase Auth Google OAuth → `auth.uid()` 활성화 → ask_queries.user_id 실제 사용
6. **TikTok/YouTube 영상** — YouTube Data API + Whisper-large-v3 → 자막/음성 → 텍스트 → 동일 파이프라인 (벤치마크 보고서 부록 참조)
7. **배포** — Vercel (FE) + Modal/Railway (ai-worker) + Supabase Cloud
8. **단위 테스트** — `tests/` 디렉토리 비어 있음. pytest 도입

---

## 9. 알려진 함정 + 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `pip install` 시 `hdbscan` / `numba` wheel 실패 | Python 3.13 너무 최신 | 3.11 또는 3.12 venv 사용 |
| BGE-M3 다운로드 5분 이상 멈춤 | HF Hub anonymous rate limit | `HF_TOKEN` 환경변수 설정 (https://huggingface.co/settings/tokens) |
| PowerShell 콘솔에서 한글 깨짐 (`íì¥í`) | cp949 출력 인코딩 | `chcp 65001` 또는 Python `sys.stdout.reconfigure(encoding="utf-8")` (이미 scripts 에 적용됨) |
| Recharts SVG SSR 시 빈 div | ResponsiveContainer 부모 크기 0 | 부모 div 에 명시 height. 또는 hydration 후 자동 그려짐 |
| Supabase RLS 정책 변경 후 권고 | `auth.uid()` 가 행마다 재평가 | `(select auth.uid())` 로 감싸기. `dilab_advisor_fixes` 마이그레이션 참고 |
| Playwright `fill` 후 button disabled | React controlled input 의 state 미갱신 | `evaluate` 로 native setter + `dispatchEvent("input", {bubbles:true})` |
| `auto_ingest` 가 실패 후 documents 만 들어감 | 트랜잭션 안 묶임 — partial commit | 실패 시 SQL로 `delete from documents where product_id = ...` 후 재실행 |
| Next.js create-next-app 의 globals.css 자동 다크모드 | `prefers-color-scheme: dark` 미디어 쿼리 | DILAB 은 라이트 전용 — 미디어 쿼리 제거됨 (현재 상태) |

---

## 10. 메모리 (Claude Code agent 용)

`~/.claude/projects/c--DILAB/memory/MEMORY.md` 에 다음 entry 들이 있음:

- `user_role.md` — AI 대학원생, 기술/연구 톤 선호 (PM 비즈니스 톤 X)
- `feedback_pm_business_depth.md` — DILAB 산출물은 기술 명세, 비즈니스 PRD X
- `feedback_ux_friendly.md` — 사용자 대상 UI 는 친근한 톤 (이모지·"~해요"·"당신에게?"). 내부 문서는 기술 톤
- `feedback_skillsmp_install.md` — skillsmp install 도구 broken, CLI 사용

새 agent 가 처음 작업 시작할 때 위 메모리도 자동 로드됨.

---

## 11. 키 핵심 파일 (agent 가 *반드시 먼저 읽어야* 할 순서)

```
1. README.md                          전체 한눈에
2. CLAUDE.md                          프로젝트 정책 (자동 로드)
3. docs/AGENT_HANDOFF.md              이 파일
4. docs/HOW_IT_WORKS.md               기술 동작 + 외부 설명
5. docs/research/tech-stack-decision.md  ADR
6. docs/db/schema.md                  ERD v0.2 + 핵심 쿼리
7. docs/prd/dilab-mvp-prd.md          PRD v0.2 (B1~B6 + ★1·★2)
8. ai-worker/README.md                백엔드 설치
9. (이후 코드)
```

---

*문서 끝 — 이 문서가 stale 해지면 README 의 *현재 데이터*  / 마일스톤 / 다음 작업 후보 갱신 필요.*
