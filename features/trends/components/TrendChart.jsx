"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function TrendChart({ data = [], unit = null }) {
  const id = useId().replace(/:/g, "");
  const containerRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(360);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return undefined;

    const updateWidth = () => {
      const nextWidth = Math.max(320, Math.round(container.getBoundingClientRect().width));
      setMeasuredWidth((current) => current === nextWidth ? current : nextWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (!data.length) {
    return (
      <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        داده عددی کافی برای نمودار وجود ندارد.
      </p>
    );
  }

  const width = measuredWidth;
  const height = 260;
  const padding = { top: 24, right: 18, bottom: 48, left: 54 };
  const values = data.map((item) => Number(item.value)).filter(Number.isFinite);
  if (!values.length) {
    return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">مقادیر عددی قابل نمایش در این نمودار وجود ندارد.</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((item, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + (1 - (Number(item.value) - min) / spread) * chartHeight;
    return { ...item, x, y };
  }).filter((point) => Number.isFinite(point.y));

  if (!points.length) {
    return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">مقادیر این نمودار قابل نمایش نیستند.</p>;
  }

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const visibleLabels = Math.max(2, Math.floor(width / 110));
  const labelStep = Math.max(1, Math.ceil(points.length / visibleLabels));
  const gradientId = `trend-${id}`;

  return (
    <div ref={containerRef} className="w-full min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`نمودار روند ${unit ? `بر حسب ${unit}` : "نتایج"}`}
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopOpacity="0.18" />
            <stop offset="100%" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="currentColor"
          strokeOpacity="0.12"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="currentColor"
          strokeOpacity="0.12"
        />

        <path
          d={`${path} L ${points.at(-1).x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
          fill={`url(#${gradientId})`}
          stroke="none"
        />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-primary"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4.5"
              fill="currentColor"
              className="text-primary"
            />
            <title>{point.date}: {point.value} {unit ?? ""}</title>
          </g>
        ))}

        <text
          x={padding.left - 9}
          y={padding.top + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {max}
        </text>
        <text
          x={padding.left - 9}
          y={padding.top + chartHeight}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {min}
        </text>

        {points.map((point, index) =>
          (index % labelStep === 0 || index === points.length - 1) && (
            <text
              key={`label-${index}`}
              x={point.x}
              y={height - 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {point.date}
            </text>
          ),
        )}
      </svg>
    </div>
  );
}
