export function InsightsPanel({
  aName,
  bName,
  aStrengths,
  bStrengths,
  actions,
  positioning,
}: {
  aName: string;
  bName: string;
  aStrengths: string[];
  bStrengths: string[];
  actions: string[];
  positioning: string;
}) {
  return (
    <div className="space-y-4">
      {positioning && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
          <div className="text-xs font-semibold text-indigo-700 mb-2 tracking-wide uppercase">
            🎯 한 줄 포지셔닝 (자사)
          </div>
          <p className="text-base font-bold text-indigo-900 leading-relaxed">
            “{positioning}”
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StrengthCard
          title={`💎 ${aName} 강점`}
          items={aStrengths}
          tone="indigo"
        />
        <StrengthCard
          title={`⚖️ ${bName} 강점`}
          items={bStrengths}
          tone="amber"
        />
      </div>

      {actions.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-zinc-500 mb-3 tracking-wide uppercase">
            💡 추천 마케팅 액션 (자사)
          </div>
          <ul className="space-y-2 text-sm">
            {actions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-600 font-bold tabular-nums">
                  {i + 1}.
                </span>
                <span className="text-zinc-700 leading-relaxed">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StrengthCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "indigo" | "amber";
}) {
  const cls =
    tone === "indigo"
      ? "bg-indigo-50/40 border-indigo-100"
      : "bg-amber-50/40 border-amber-100";
  return (
    <div className={`rounded-lg border ${cls} p-4`}>
      <div className="text-xs font-semibold mb-2 tracking-wide">{title}</div>
      <ul className="space-y-1.5 text-sm text-zinc-700">
        {items.map((s, i) => (
          <li key={i}>• {s}</li>
        ))}
      </ul>
    </div>
  );
}
