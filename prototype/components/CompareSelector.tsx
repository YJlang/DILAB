"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompareSelector({
  currentSlug,
  others,
}: {
  currentSlug: string;
  others: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [other, setOther] = useState("");

  function go() {
    if (!other) return;
    router.push(`/compare/${currentSlug}/${other}`);
  }

  if (others.length === 0) {
    return (
      <span className="text-xs text-zinc-400">
        비교할 다른 제품이 아직 없어요
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={other}
        onChange={(e) => setOther(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">⚖️ 다른 제품과 비교…</option>
        {others.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name.length > 35 ? o.name.slice(0, 35) + "…" : o.name}
          </option>
        ))}
      </select>
      <button
        onClick={go}
        disabled={!other}
        className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-zinc-300"
      >
        비교 ▶
      </button>
    </div>
  );
}
