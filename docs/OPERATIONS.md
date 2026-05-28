# DILAB 운영 가이드 — Cloudflare 배포 + 로컬 ai-worker

> 이 문서는 **이미 한 번 배포된 환경에서 PC를 끄고 켰을 때**, 또는 **다른 환경에서 이어받을 때** 운영을 빠르게 복구하는 절차다. *최초 세팅*은 [AGENT_HANDOFF.md](AGENT_HANDOFF.md) 3절 참조.
>
> **AS_OF**: 2026-05-28
> **현재 배포**: `https://dilab.sean111400.workers.dev` (Cloudflare Workers + OpenNext)

---

## 0. 한눈에 보는 토폴로지

```
브라우저
   ↓  https://dilab.sean111400.workers.dev
[Cloudflare Workers]  ── Next.js 16 (OpenNext 어댑터)
   │   - SSR / API routes / 정적 자산 모두 Worker 안에서
   │   - vars: SUPABASE_URL, SUPABASE_ANON_KEY, AI_WORKER_URL
   │
   ├──► Supabase (managed, mxofuzhfdthqpzhzctwd.supabase.co)
   │       - anon key 사용 (RLS 보호)
   │
   └──► AI_WORKER_URL = trycloudflare.com 임시 도메인
            ↓ HTTPS
       [cloudflared Quick Tunnel]  (사용자 PC 에서 실행)
            ↓ 로컬 포트 8000 으로 포워딩
       [FastAPI ai-worker]          (사용자 PC 에서 실행)
            - BGE-M3 임베딩 (1024d, ~2GB 가중치)
            - BERTopic / DeepSeek / Supabase service_role
```

요점 3가지:
1. **프론트와 DB 는 24/7 살아있음** (Workers + Supabase)
2. **ai-worker + tunnel 은 PC 가 켜져있을 때만** 작동 → 분석·Ask 같은 AI 기능은 PC 가 살아있어야 함
3. **Quick Tunnel URL 은 재기동마다 바뀜** → ai-worker 재시작 시 Worker `vars.AI_WORKER_URL` 도 갱신 + 재배포 필요

---

## 1. PC 부팅 후 매일 루틴 (2~3분)

```powershell
# A. ai-worker 기동 (PowerShell 창 #1)
cd C:\dilab\ai-worker
.\.venv\Scripts\Activate.ps1
uvicorn src.main:app --host 0.0.0.0 --port 8000
# → "Application startup complete." 메시지 확인
# → 첫 기동은 BGE-M3 로딩 ~10~30초 (캐시된 상태)

# B. cloudflared Quick Tunnel 기동 (PowerShell 창 #2)
cloudflared tunnel --url http://localhost:8000
# → 로그에서 "https://<random>.trycloudflare.com" URL 받아 적기
```

`<random>` 은 매번 바뀐다. 예: `alberta-saturday-attended-attempted.trycloudflare.com`.

```powershell
# C. 받은 URL 을 wrangler.jsonc 의 AI_WORKER_URL 에 반영
#     prototype/wrangler.jsonc 의 vars.AI_WORKER_URL 줄을 새 URL 로 교체

# D. 재배포 (PowerShell 창 #3)
cd C:\dilab\prototype
npm run deploy
# → opennextjs-cloudflare build (2~5분) + wrangler deploy (~30초)
```

배포 끝나면 `https://dilab.sean111400.workers.dev` 가 새 tunnel 을 가리킨다.

> **`npm run deploy` 는 build + deploy 한 줄.** 이전 빌드 산출물을 그대로 올리면 `ChunkLoadError` 가 난다 — [9절 함정 5](#9-함정-trouble-shooting) 참조.

---

## 2. 동작 검증 (배포 후 30초 헬스체크)

```powershell
# 로컬 ai-worker
curl http://localhost:8000/health

# tunnel 경유 ai-worker
curl https://<random>.trycloudflare.com/health

# Worker → ai-worker (RAG 한 번 돌려보기)
curl -X POST https://dilab.sean111400.workers.dev/api/ask `
     -H "Content-Type: application/json" `
     -d '{\"query\":\"보습력 어때?\",\"domain_id\":\"cosmetics\"}'
```

기대값:
- 셋 다 **HTTP 200**
- `/api/ask` 응답은 **4~7초** (BGE-M3 임베딩 + match_chunks + DeepSeek 합성)
- 첫 호출에서 BGE-M3 가 아직 안 따뜻하면 +10~30초

---

## 3. 종료 루틴

PC 끄기 전 따로 정리할 건 없다. PowerShell 두 창을 Ctrl+C 로 닫으면 끝. **Worker 와 Supabase 는 그대로 살아있고**, 사용자가 `/products`, `/dashboard` 같은 정적 페이지는 계속 볼 수 있다 (DB 조회만 함). **분석/Ask 만 막힌다.**

---

## 4. 환경 변수 — 어디에 무엇이 있는가

### 4.1 `ai-worker/.env` (PC 로컬, gitignore)

| 변수 | 값/출처 |
|---|---|
| `SUPABASE_URL` | `https://mxofuzhfdthqpzhzctwd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role *(절대 브라우저·git X)* |
| `DEEPSEEK_API_KEY` | platform.deepseek.com |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `LLM_MODEL` | `deepseek-chat` |
| `EMBEDDING_MODEL_NAME` | `BAAI/bge-m3` |
| `EMBEDDING_DIMENSION` | `1024` |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | developers.naver.com |

### 4.2 `prototype/.env.local` (PC 로컬, gitignore — local dev 전용)

| 변수 | 값 |
|---|---|
| `SUPABASE_URL` | 같은 Supabase URL |
| `SUPABASE_ANON_KEY` | `sb_publishable_...` 또는 `eyJhbGc...` (publishable, RLS 로 보호) |
| `AI_WORKER_URL` | `http://127.0.0.1:8000` (개발) |

> ⚠️ **`NEXT_PUBLIC_` 접두사 절대 사용 X.** Next.js 가 build 시점에 값을 inline 한다 (DefinePlugin). Cloudflare runtime vars 가 적용되지 않아 production 에서 `undefined` 가 박힌다. *server-only* 사용이므로 접두사 없이도 충분.

### 4.3 `prototype/wrangler.jsonc` (git 추적 — production vars 의 source-of-truth)

```jsonc
"vars": {
  "SUPABASE_URL": "https://mxofuzhfdthqpzhzctwd.supabase.co",
  "SUPABASE_ANON_KEY": "eyJhbGc...",         // publishable, RLS 보호 → git OK
  "AI_WORKER_URL": "https://<random>.trycloudflare.com"
}
```

> ⚠️ **`wrangler deploy` 는 `vars` 블록을 dashboard 덮어쓴다**. 즉 dashboard 에서 직접 추가한 환경변수는 deploy 시 *삭제*된다. `keep_vars: true` 가 그걸 막아주지만, **새 변수는 반드시 이 파일에 추가**해야 안정적.

---

## 5. MCP 서버 (4종)

`.mcp.json` 에 project scope 로 등록되어 있다. Claude Code 가 자동 로드.

| 서버 | 용도 | 인증 |
|---|---|---|
| `supabase` | DB 조회·마이그레이션·RPC | `/mcp → supabase → Authenticate` (OAuth) |
| `cloudflare-bindings` | Worker / KV / D1 / R2 조회·수정 | OAuth |
| `cloudflare-builds` | Worker 빌드 로그 (Git 연동 시) | OAuth |
| `cloudflare-observability` | Worker logs/metrics 쿼리 | OAuth |

새 환경에서는 4개 모두 `/mcp` 메뉴에서 한 번씩 인증해야 한다.

운영 디버깅에서 가장 자주 쓰는 도구:
- `mcp__cloudflare-observability__query_worker_observability` — 최근 에러 로그 검색
- `mcp__supabase__execute_sql` — RLS 우회 SQL 실행 (테스트용)

---

## 6. 흔한 시나리오별 처방

### 시나리오 A. 사이트 들어가니 "ai-worker 530" 토스트가 뜬다

거의 항상 **Worker → 옛 tunnel URL 가리킴**. cloudflared 가 죽거나 재시작돼서 URL 이 바뀌었는데 wrangler.jsonc 갱신·재배포가 안 된 상태.

```powershell
# 1. cloudflared 가 살아있는지 확인
Get-Process cloudflared

# 2. 죽었으면 새로 띄우고 URL 받아 적기
cloudflared tunnel --url http://localhost:8000

# 3. wrangler.jsonc 의 AI_WORKER_URL 교체 → npm run deploy
```

observability 로 정확한 에러 확인:
```
Error: ... 530: error code: 1016
```
1016 = Origin DNS error (= 옛 tunnel URL DNS resolve 실패). 확정.

### 시나리오 B. /api/analyze 가 502 만 뜬다

**구조적 한계.** Cloudflare Workers Free 의 30초 하드 타임아웃 vs `/analyze` 의 60~90초 처리 시간. 해결 = ai-worker 측 비동기 큐 + polling 도입 (PRD 의 다음 작업 후보). 임시로는 Workers Paid 로 업그레이드해도 5분이 한계.

### 시나리오 C. 페이지가 500 + `ChunkLoadError`

OpenNext 빌드가 stale 한 상태에서 `wrangler deploy` 만 돌렸을 때 발생.

```powershell
# 정답:
cd C:\dilab\prototype
npm run deploy        # = opennextjs-cloudflare build && wrangler deploy
```

### 시나리오 D. `wrangler deploy` 가 `CLOUDFLARE_API_TOKEN` 요구

비대화형 셸 (Claude Code 의 PowerShell tool 등) 에서는 OAuth cache 를 못 읽는다. **사람이 직접 PowerShell 창에서** 실행하거나, `wrangler login` 으로 한 번 OAuth → 그 후에는 토큰 입력 없이 됨.

### 시나리오 E. 분석 결과가 안 뜨거나 한참 걸린다

BGE-M3 cold start. ai-worker 가 갓 부팅됐다면 첫 호출은 모델 가중치 메모리 로드에 10~30초.

```powershell
# warm-up
curl http://localhost:8000/health
# → 두 번째부터는 빠름
```

---

## 7. 9. 함정 (trouble-shooting)

| # | 증상 | 진짜 원인 | 해결 |
|---|---|---|---|
| 1 | 배포 후 `/products` 등 500, "supabaseUrl is required" | `lib/supabase.ts` 가 module 평가 시점에 `createClient(undefined, ...)` 호출 → Next.js "Collecting page data" 가 throw | Lazy Proxy 패턴 (이미 적용됨, `prototype/lib/supabase.ts` 참조) |
| 2 | runtime vars 가 안 잡힘 — Cloudflare dashboard 에 넣어도 `undefined` | `NEXT_PUBLIC_*` 접두사가 빌드 시점 inline. dashboard runtime override 못 함 | 접두사 제거, **server-only** 로 사용 (`process.env.SUPABASE_URL`) |
| 3 | `wrangler deploy` 마다 dashboard 환경변수가 삭제됨 | `wrangler.jsonc` 의 `vars` 가 source-of-truth, deploy 마다 덮어씀 | `keep_vars: true` 추가 + 모든 변수는 `wrangler.jsonc` 에 박기 |
| 4 | 530 + `error code: 1016` | Worker 가 fetch 하는 origin DNS 가 resolve 안 됨 (Quick Tunnel URL 변경됨) | wrangler.jsonc 의 `AI_WORKER_URL` 갱신 후 `npm run deploy` |
| 5 | 500 + `ChunkLoadError: Failed to load chunk ...` | OpenNext 빌드 산출물(`.open-next/`)이 stale 한데 `wrangler deploy` 만 돌림 | 항상 `npm run deploy` 또는 `npx opennextjs-cloudflare build && npx wrangler deploy` |
| 6 | `/api/analyze` 502 만 뜸 | Cloudflare Workers Free 30초 하드 limit < `/analyze` 60~90초 | (deferred) ai-worker 측 async queue + 클라이언트 polling |
| 7 | ai-worker 가 첫 요청에 10~30초 멈춤 | BGE-M3 lazy load (`lru_cache`) | warm-up: `curl http://localhost:8000/health` |
| 8 | uvicorn 단일 worker 라 동시 요청이 막힘 | `--workers 1` 기본 + sync analyze | 다중 worker (`--workers 2`) 또는 비동기 큐 |

---

## 8. 배포 산출물 (참고)

- **빌드 폴더**: `prototype/.open-next/` — gitignore. `worker.js` + 정적 자산.
- **wrangler 로그**: `C:\Users\<user>\AppData\Roaming\xdg.config\.wrangler\logs\` — wrangler 에러 시 여기 확인.
- **로컬 로그**: `.run/ai-worker.log`, `.run/cloudflared.log` — 디버깅용.

---

## 9. 운영 비용 (AS_OF 2026-05-28)

| 항목 | 비용 | 비고 |
|---|---|---|
| Cloudflare Workers Free | $0 | 일 100,000 req, 10ms CPU/req, 30s wall — MVP 충분 |
| Supabase Free | $0 | DB 500MB, 2GB egress, 500k Edge Function req |
| DeepSeek API | ~$0.27 / 1M tokens 입력 | 한 제품 자동 분석 약 45 LLM 호출 → 약 $0.02 |
| cloudflared Quick Tunnel | $0 | 인증·도메인 불필요. URL 매번 변동 |
| ai-worker 호스팅 | $0 (PC 켜져있을 때) | 향후 Modal/Railway 로 이전 시 ~$5~20/월 |

**합계: 월 $0 ~ 데모 부담 없음.** 본격 운영 (24/7 ai-worker, 도메인) 시 ~$10~30/월.

---

## 10. 관련 문서

- [AGENT_HANDOFF.md](AGENT_HANDOFF.md) — 최초 세팅·전체 컨텍스트
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md) — 내부 동작 (외부 설명용)
- [research/tech-stack-decision.md](research/tech-stack-decision.md) — M1 ADR
- `prototype/wrangler.jsonc` — Worker 설정 source-of-truth
- `prototype/AGENTS.md` — Next.js 16 변경 주의 + 배포 명령
