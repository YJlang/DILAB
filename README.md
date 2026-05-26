# DILAB (딜랩)

> 임상순 교수님 연구실의 가칭 MVP 프로젝트. 싱클리(Syncly)를 벤치마킹하여, **전문가 리뷰 DB + 벡터 DB + RAG**로 *어디서 가져온 결론인지* 매번 보여주는 도메인 특화 제품 평가 서비스를 만들었습니다.

## 한눈에 보기

- **상태**: 풀스택 MVP 가동 (2026-05-27). S1~S6 화면 + 자동 분석 파이프라인 + Supabase 영속화 완성.
- **데모 URL**: `http://localhost:3000` (로컬). 제품명 입력 → 1분 → 리포트 자동 생성.
- **포지셔닝**: ***"양으로 답하는 싱클리, 질로 답하는 DILAB"*** — 모든 답변·점수에 출처 chunk 추적
- **언어**: 한국어 (코드·기술명은 영문 유지)

## 풀 스택 구성 (3 컴포넌트)

```
prototype/        Next.js 16 + React 19 + Tailwind 4 + Recharts   (포트 3000)
ai-worker/        Python FastAPI + BGE-M3 + BERTopic + DeepSeek   (포트 8000)
Supabase          Postgres + pgvector + RLS + Auth + Storage      (cloud)
```

데이터 흐름 (1 cycle = 1분):

```
사용자 입력 "제품명"
   ↓ Next.js /api/analyze → ai-worker /analyze
   ├── 네이버 검색 API (reviews 30 + expert 15 + shop 메타)
   ├── BGE-M3 임베딩 (1024 dim) → Supabase pgvector
   ├── BERTopic 토픽 분리 (UMAP + HDBSCAN)
   ├── DeepSeek 라벨링 (분류·감성·여정 동시 호출)
   └── 5축 평가 점수 + evidence_chunk_ids
   ↓
/products/<slug> 자동 redirect
```

## 화면 (S0 ~ S6)

| 화면 | 경로 | 핵심 |
|---|---|---|
| S0 랜딩 (분석 form) | `/` | 제품명 입력 → 1분 자동 분석 |
| S1 단일 제품 리포트 | `/products/<slug>` | 5축 레이더 + 감성 + 토픽 + ★출처 카드 |
| S2 Ask 풀 화면 | `/ask?product=<slug>` | 대화형 RAG Q&A + 출처 인용 |
| S3 토픽 탐색 | `/topics` | BERTopic 결과 카드 + 키워드 + 대표 청크 |
| S4 사용자 여정 | `/journey/<slug>` | 4단계 퍼널 + 단계별 청크 인용 |
| S5 도메인 대시보드 | `/dashboard` | KPI + 제품 비교 + 도메인 전체 통계 |
| S6 경쟁사 비교 | `/compare/<a>/<b>` | 5축 겹친 레이더 + DeepSeek 마케팅 인사이트 |

## 핵심 차별화 (★)

- **★1 출처 카드 가시화** — `citations` 테이블 + `ratings.evidence_chunk_ids[]` 로 모든 답변·점수가 *어느 청크에서 나왔는지* 추적
- **★2 도메인-플렉시블** — `domains` 의 JSONB 컬럼(`categories`/`rating_axes`/`journey_stages`)으로 새 도메인 추가 = SQL 1줄. 모든 화면 자동 적용.

## 핵심 문서

| 파일 | 용도 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 프로젝트 정책·정체성 (Claude Code 자동 로드) |
| [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) | **다른 환경·다른 agent 가 작업 이어받기** |
| [`docs/HOW_IT_WORKS.md`](docs/HOW_IT_WORKS.md) | **초보자용 내부 동작 + 외부 설명 가이드** (30초·3분·10분 버전) |
| [`docs/prd/dilab-mvp-prd.md`](docs/prd/dilab-mvp-prd.md) | PRD v0.2 (B1~B6 + ★1·★2) |
| [`docs/db/schema.md`](docs/db/schema.md) | ERD v0.2 — 15 테이블 + RLS + 핵심 쿼리 |
| [`docs/research/tech-stack-decision.md`](docs/research/tech-stack-decision.md) | M1 기술 스택 ADR (Supabase + Python + DeepSeek) |
| [`docs/design/prototype-plan.md`](docs/design/prototype-plan.md) | UI 디자인 계획서 (v2 — 친근 톤) |
| [`docs/design/syncly-info-architecture.md`](docs/design/syncly-info-architecture.md) | 싱클리 정보 구조 분석 (시각 모방 X, 차용 패턴만) |
| [`benchmark/syncly-benchmark.md`](benchmark/syncly-benchmark.md) | 싱클리 벤치마킹 (33소스, 약 14,000자) |
| [`PLAN.MD`](PLAN.MD) | 교수님과의 대화 원문 (수정 금지) |

## 빠른 시작 (새 환경 가정)

자세한 절차: [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md)

```powershell
# 1) 저장소 + Supabase MCP 인증
git clone https://github.com/YJlang/DILAB.git C:\DILAB
cd C:\DILAB
# Claude Code 안에서: /mcp → supabase → Authenticate

# 2) ai-worker (.env 작성 후)
cd ai-worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env  # 키 채우기
uvicorn src.main:app --host 127.0.0.1 --port 8000

# 3) Next.js (다른 터미널, .env.local 작성 후)
cd ..\prototype
npm install
npm run dev
# http://localhost:3000
```

필요한 secret 키 3종 (모두 무료 또는 매우 저렴):
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API
- `DEEPSEEK_API_KEY` — platform.deepseek.com
- `NAVER_CLIENT_ID/SECRET` — developers.naver.com (일 25,000 무료)

## 절대 규칙 (자세한 내용은 [`CLAUDE.md`](CLAUDE.md))

- **싱클리 UX/UI 시각적 모방 금지** — MVP가 타사에 활용될 수 있어 시각 유사성 회피 필수. 정보 구조 차용은 OK ([syncly-info-architecture.md](docs/design/syncly-info-architecture.md) 참조)
- **출처 검증** — 모든 시간민감 주장에는 `AS_OF` 명시, 공식 1차 출처 우선
- **개인 권한·환경변수 파일 공유 금지** — `.claude/settings.local.json`, `ai-worker/.env`, `prototype/.env.local` 모두 `.gitignore`

## 현재 데이터 (Supabase, 2026-05-27)

- 도메인 1개 (cosmetics) · 제품 2개 (아누아 어성초 77 토너 + 닥터지 레드 블레미쉬 시카 수딩 크림)
- documents 83건 · chunks 87건 (전체 BGE-M3 임베딩 완료)
- 분류 ~180행 · 감성 87행 · 여정 ~80행
- 토픽 2개 (BERTopic, outlier 0) · 평가 10행 (2제품 × 5축)
- 마이그레이션 4개 적용 (initial_setup, advisor_fixes, match_chunks v3, user_nullable)

## 다음 작업 후보 (우선순위 순)

1. 데이터 확장 — 3~5 제품 더 자동 분석 (S5·S6 의미 ↑)
2. slug 갱신 — 옛 `70ml-1-d5609967` → `drg-red-blemish-...` (SQL 1줄)
3. 두 번째 도메인 (F&B 또는 가전) — ★2 진짜 입증
4. 비동기 분석 + SSE 진행률
5. Supabase Auth 활성화 → ask_queries.user_id 실사용
6. TikTok/YouTube 영상 (Whisper 인프라)
7. 배포 (Vercel + Modal + Supabase Cloud)
8. 단위 테스트 (`tests/` 비어 있음)

자세한 후속 작업: [`docs/AGENT_HANDOFF.md`](docs/AGENT_HANDOFF.md) 8절.
