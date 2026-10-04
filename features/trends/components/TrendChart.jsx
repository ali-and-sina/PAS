"use client";

import { useMemo } from "react";

function getNumericValue(row) {
  return row.value_numeric == null
    ? null
    : Number(row.value_numeric);
}

export default function TrendChart({ data }) {
  const points = useMemo(
    () =>
      (data || [])
        .map((row, index) => ({
          index,
          value: getNumericValue(row),
        }))
        .filter((point) => Number.isFinite(point.value)),
    [data],
  );

  if (points.length < 2) return null;

  const width = 720;
  const height = 240;
  const padding = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chartPoints = points.map((point, index) => {
    const x =
      padding +
      (index / Math.max(points.length - 1, 1)) *
        (width - padding * 2);
    const y =
      height -
      padding -
      ((point.value - min) / range) *
        (height - padding * 2);

    return `${x},${y}`;
  });

  return (
    <div className="overflow-x-auto" dir="ltr">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="نمودار روند نتایج آزمایش"
        className="min-w-[620px] w-full"
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          strokeOpacity="0.15"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="currentColor"
          strokeOpacity="0.15"
        />

        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={chartPoints.join(" ")}
        />

        {points.map((point, index) => {
          const [x, y] = chartPoints[index].split(",");

          return (
            <circle
              key={`${point.index}-${point.value}`}
              cx={x}
              cy={y}
              r="4"
              fill="currentColor"
            />
          );
        })}
      </svg>
    </div>
  );
}
