type Counts = { positive: number; neutral: number; negative: number };

export function SentimentBars({ counts }: { counts: Counts }) {
  const total = counts.positive + counts.neutral + counts.negative;
  if (total === 0)
    return <p className="text-sm text-zinc-500">감성 데이터가 아직 없어요.</p>;

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="space-y-2">
      <Row label="😊 좋아요" pct={pct(counts.positive)} color="bg-indigo-500" />
      <Row label="😐 그저그래요" pct={pct(counts.neutral)} color="bg-amber-400" />
      <Row label="😣 아쉬워요" pct={pct(counts.negative)} color="bg-zinc-400" />
    </div>
  );
}

function Row({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-sm">{label}</span>
      <div className="flex-1 h-5 bg-zinc-100 rounded-sm overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
