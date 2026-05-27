import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const envKeys = Object.keys(process.env).filter((k) =>
      k.startsWith("NEXT_PUBLIC_") || k === "AI_WORKER_URL",
    );
    console.error("supabase env missing", {
      hasUrl: !!url,
      hasKey: !!key,
      visibleKeys: envKeys,
      totalEnvCount: Object.keys(process.env).length,
    });
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY required at runtime",
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Lazy proxy — module evaluate 시 createClient 호출 안 함.
// 빌드 컨테이너에 env 없어도 모듈 평가는 통과, 실제 호출 시점에만 init.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
