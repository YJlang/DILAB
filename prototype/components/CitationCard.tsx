export function CitationCard({
  expertCount,
  publicCount,
}: {
  expertCount: number;
  publicCount: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold text-zinc-500 mb-3 tracking-wide">
        📚 어디서 가져온 정보?
      </div>

      <Row icon="👩‍🔬" label="전문가 의견" n={expertCount} bar="bg-indigo-500" />
      <div className="h-3" />
      <Row icon="👥" label="일반 사용자" n={publicCount} bar="bg-amber-500" />

      <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
        💡 모든 평가는 위 출처에 기반해요. 클릭하면 원문 인용이 펼쳐져요.
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  n,
  bar,
}: {
  icon: string;
  label: string;
  n: number;
  bar: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm">
        <span>
          {icon} {label}
        </span>
        <span className="font-semibold tabular-nums">{n}건</span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-sm overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: n > 0 ? "100%" : "0%" }} />
      </div>
    </div>
  );
}
