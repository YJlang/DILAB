"use client";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer,
} from "recharts";

type AxisPoint = { axis: string; product: number; category?: number };

export function RadarChart({
  data,
  height = 320,
}: {
  data: AxisPoint[];
  height?: number;
}) {
  const summary = data
    .map((d) => `${d.axis} ${d.product.toFixed(1)}점`)
    .join(", ");
  return (
    <div role="img" aria-label={`5축 점수: ${summary}`}>
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} cx="50%" cy="50%" outerRadius="75%">
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
        {data[0]?.category !== undefined && (
          <Radar
            name="카테고리 평균"
            dataKey="category"
            stroke="#F59E0B"
            strokeDasharray="3 3"
            fill="#F59E0B"
            fillOpacity={0.1}
          />
        )}
        <Radar
          name="이 제품"
          dataKey="product"
          stroke="#4F46E5"
          fill="#4F46E5"
          fillOpacity={0.25}
          strokeWidth={2}
        />
      </RechartsRadar>
    </ResponsiveContainer>
    </div>
  );
}
