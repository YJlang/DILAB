<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# DILAB prototype — 배포 메모

## 환경 변수
- **production**: `wrangler.jsonc` 의 `vars` 블록이 source-of-truth. dashboard 에서 직접 추가하지 말 것 (`keep_vars: true` 가 있긴 하지만 변수는 이 파일에 박아 일관성 유지).
- **로컬 dev**: `.env.local` (gitignore). 템플릿은 `.env.local.example`.
- **`NEXT_PUBLIC_` 접두사 절대 사용 X.** Next.js 가 build 시점에 inline → Cloudflare Workers runtime vars 가 안 잡힌다. 모든 환경 변수는 *server-only* (route handlers / Server Components / SSR) 에서만 사용.

## 배포 명령
```powershell
npm run deploy   # = opennextjs-cloudflare build && wrangler deploy
```

`wrangler deploy` 만 단독으로 돌리지 말 것 — `.open-next/` 가 stale 한 채로 올라가면 production 에서 `ChunkLoadError` 가 난다.

## cloudflared Quick Tunnel
ai-worker 를 PC 에서 띄우고 Workers 가 fetch 하도록 노출하는 채널. URL 은 **재기동마다 바뀐다** — 바뀌면 `wrangler.jsonc` 의 `vars.AI_WORKER_URL` 갱신 → `npm run deploy`.

자세한 운영 절차: [`../docs/OPERATIONS.md`](../docs/OPERATIONS.md).

---

## ⚠️ 디자인·UI 리팩토링 시 절대 건드리지 말 것

UI 만 손대고 배포하면 ai-worker / Supabase / tunnel 매핑은 자동 유지된다. 단 아래 4 곳은 매핑의 *핵심* 이라 무심코 건드리면 빌드가 깨지거나 사이트 전체가 500/530 으로 다운된다.

1. **`wrangler.jsonc` 의 `vars` 블록** — 특히 `AI_WORKER_URL`. 현재 tunnel 도메인이 박혀있다. 디자인 작업 중 이 파일을 열 일이 없게 할 것.
2. **`lib/supabase.ts` 의 lazy Proxy 패턴**. 무심코 `export const supabase = createClient(url, key)` 같은 즉시 호출 형태로 되돌리면 build 시점에 `"supabaseUrl is required"` 로 죽는다. *getter 안에서만 createClient* 가 호출되는 구조를 유지.
3. **server-only 환경 변수 참조**:
   - `app/api/ask/route.ts` / `app/api/analyze/route.ts` / `app/compare/[a]/[b]/page.tsx` 등에서 `process.env.AI_WORKER_URL` 그대로.
   - `NEXT_PUBLIC_` 접두사 *다시* 붙이지 말 것 (DefinePlugin 이 build-time inline → Cloudflare runtime vars 가 안 잡힘).
4. **`.env.local` 의 키 이름** — `AI_WORKER_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` 그대로. `NEXT_PUBLIC_` 접두사 추가 X.

## ✅ 자유롭게 손대도 되는 영역

- `app/` 의 `page.tsx` / `layout.tsx` / 새 라우트 / 새 페이지 추가
- `components/` 모든 UI 컴포넌트 (RadarChart, JourneyMap, AskBox, CitationCard 등)
- Tailwind 클래스, `globals.css`, 컬러 토큰, 폰트, 간격, 애니메이션
- Recharts 옵션 / 차트 시각 표현 / SVG 마크업
- `lib/types.ts` (단 데이터 모델 변경은 `ai-worker/src/` 와 함께)

디자인 변경 후 배포는 항상:
```powershell
npm run deploy
```
→ ai-worker / Supabase / tunnel 매핑 그대로, UI 만 새 버전으로 갱신.

(싱클리 UX/UI 시각적 모방 금지 — `CLAUDE.md` 2.1 의 hard rule.)
