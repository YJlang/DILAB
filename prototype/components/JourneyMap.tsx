type Stage = {
  key: string;
  label: string;
  order: number;
};

type StageData = {
  n: number;
  positive_pct: number;
};

export function JourneyMap({
  stages,
  data,
}: {
  stages: Stage[];
  data: Record<string, StageData>;
}) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-bold">🗺️ 사람들의 구매·사용 여정</h2>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sorted.map((s, i) => {
          const d = data[s.key];
          const isHighlight = s.key === "rebuy";
          return (
            <div
              key={s.key}
              className={`rounded-md p-4 border ${
                isHighlight
                  ? "bg-amber-50/50 border-amber-200"
                  : "bg-zinc-50 border-zinc-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-6 h-6 rounded-full text-white grid place-items-center text-xs font-bold ${
                    isHighlight ? "bg-amber-500" : "bg-indigo-600"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    isHighlight ? "text-amber-700" : "text-zinc-700"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-zinc-500">
                  <span className="font-semibold text-zinc-900 tabular-nums">
                    {d?.n ?? 0}명
                  </span>{" "}
                  언급
                </span>
                <span
                  className={`tabular-nums font-semibold ${
                    (d?.positive_pct ?? 0) >= 70
                      ? "text-indigo-600"
                      : "text-zinc-500"
                  }`}
                >
                  😊 {d?.positive_pct ?? 0}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-500 italic mt-3">
        * LLM zero-shot 추정 (정확도 약 80%) — 정확한 분류가 아닌 경향 참고용
      </p>
    </div>
  );
}
