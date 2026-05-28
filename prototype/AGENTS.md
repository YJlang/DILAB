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
