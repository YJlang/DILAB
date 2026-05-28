"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type JobStatus = "pending" | "running" | "done" | "error";

type JobProgress = {
  step?: number;
  of_steps?: number;
  message?: string;
};

type JobRow = {
  id: string;
  status: JobStatus;
  progress: JobProgress;
  result_slug: string | null;
  error: string | null;
};

const EXAMPLES = [
  "닥터지 레드 블레미쉬 클리어 수딩 크림",
  "이니스프리 그린티 시드 세럼",
  "아비브 어성초 카밍 토너",
  "메디힐 NMF 마스크팩",
];

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5분

export function AnalyzeForm() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollOnce(jobId: string, startedAt: number) {
    try {
      const r = await fetch(`/api/analyze/status/${jobId}`);
      if (!r.ok) {
        const txt = await r.text();
        stopPolling();
        setError(`상태 조회 실패 (${r.status}): ${txt.slice(0, 120)}`);
        setLoading(false);
        return;
      }
      const job = (await r.json()) as JobRow;
      setProgress(job.progress);

      if (job.status === "done" && job.result_slug) {
        stopPolling();
        router.push(`/products/${job.result_slug}`);
        return;
      }
      if (job.status === "error") {
        stopPolling();
        setError(job.error ?? "분석 중 알 수 없는 오류");
        setLoading(false);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPolling();
        setError("분석이 5분을 초과해 중단했어요. 운영자에게 문의해주세요.");
        setLoading(false);
      }
    } catch (e) {
      stopPolling();
      setError(`네트워크 오류: ${String(e).slice(0, 120)}`);
      setLoading(false);
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setProgress({ step: 0, of_steps: 3, message: "분석 큐에 등록 중…" });

    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_query: query.trim() }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `등록 실패 (${r.status})`);
        setLoading(false);
        return;
      }
      const { job_id } = (await r.json()) as { job_id: string };
      const startedAt = Date.now();
      // 즉시 1회 + 이후 폴링
      void pollOnce(job_id, startedAt);
      pollRef.current = setInterval(() => {
        void pollOnce(job_id, startedAt);
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xl space-y-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='제품명 입력 — 예: "닥터지 레드 블레미쉬 크림"'
          disabled={loading}
          aria-label="분석할 제품명 입력"
          className="flex-1 px-4 py-3 text-sm rounded-md border border-zinc-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-3 text-sm font-medium rounded-md bg-indigo-600 text-white disabled:bg-zinc-300 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {loading ? "분석 중…" : "분석 시작 ▶"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuery(q)}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {loading && progress && (
        <div className="text-sm text-zinc-700 bg-indigo-50/50 border border-indigo-100 rounded-md px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="font-medium">{progress.message ?? "처리 중…"}</span>
            {progress.step != null && progress.of_steps != null && (
              <span className="ml-auto text-xs text-zinc-500">
                {progress.step}/{progress.of_steps}
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500 mt-1.5">
            Modal 서버리스 함수가 백그라운드 처리 중 · 약 60~120초 소요 · 첫 실행은 모델 다운로드로 +30초
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-md whitespace-pre-wrap">
          ⚠️ {error}
        </p>
      )}
    </form>
  );
}
