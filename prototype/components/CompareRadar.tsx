"use client";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer,
} from "recharts";

type Point = { axis: string; a: number; b: number };

export function CompareRadar({
  data,
  aLabel,
  bLabel,
  height = 360,
}: {
  data: Point[];
  aLabel: string;
  bLabel: string;
  height?: number;
}) {
  const summary = data
    .map((d) => `${d.axis}: ${aLabel} ${d.a.toFixed(1)}, ${bLabel} ${d.b.toFixed(1)}`)
    .join(" | ");
  return (
    <div role="img" aria-label={`5축 비교 — ${summary}`}>
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid strokeDasharray="2 3" stroke="#CBD5E1" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 12, fontWeight: 600, fill: "#334155" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 10]}
          tick={{ fontSize: 10, fill: "#94A3B8" }}
          axisLine={false}
        />
        <Radar
          name={aLabel}
          dataKey="a"
          stroke="#4F46E5"
          fill="#4F46E5"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Radar
          name={bLabel}
          dataKey="b"
          stroke="#F59E0B"
          fill="#F59E0B"
          fillOpacity={0.18}
          strokeWidth={2}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RechartsRadar>
    </ResponsiveContainer>
    </div>
  );
}
