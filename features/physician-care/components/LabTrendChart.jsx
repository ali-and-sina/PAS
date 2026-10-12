"use client";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 32;
const PAD_TOP = 24;
const PAD_BOTTOM = 38;

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(date);
}

function formatValue(value) {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 4 }).format(value);
}

export default function LabTrendChart({ points = [], unit = null }) {
  const normalized = (Array.isArray(points) ? points : [])
    .map((point) => ({
      value: Number(point?.value),
      date: point?.date || null,
    }))
    .filter((point) => Number.isFinite(point.value) && point.date && !Number.isNaN(new Date(point.date).getTime()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (normalized.length < 2) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        برای نمایش روند عددی، دست‌کم دو نتیجهٔ ثبت‌شده لازم است.
      </div>
    );
  }

  const values = normalized.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;
  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const coordinates = normalized.map((point, index) => ({
    ...point,
    x: PAD_X + (index / (normalized.length - 1)) * plotWidth,
    y: PAD_TOP + ((max - point.value) / (max - min)) * plotHeight,
  }));
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const first = normalized[0];
  const last = normalized[normalized.length - 1];

  return (
    <div className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>قدیمی‌ترین: {formatDate(first.date)}</span>
        <span>جدیدترین: {formatDate(last.date)}</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`روند عددی ${normalized.length} نتیجه آزمایش${unit ? ` بر حسب ${unit}` : ""}`}
        className="mt-2 h-auto w-full overflow-visible"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = PAD_TOP + ratio * plotHeight;
          const value = max - ratio * (max - min);
          return (
            <g key={ratio}>
              <line x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke="currentColor" opacity="0.12" strokeDasharray="4 5" />
              <text x={PAD_X - 7} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.68">
                {formatValue(value)}
              </text>
            </g>
          );
        })}
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        {coordinates.map((point, index) => (
          <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="4.5" fill="currentColor" stroke="var(--background, white)" strokeWidth="2">
            <title>{`${formatDate(point.date)}: ${formatValue(point.value)}${unit ? ` ${unit}` : ""}`}</title>
          </circle>
        ))}
        <text x={PAD_X} y={HEIGHT - 10} textAnchor="start" fontSize="12" fill="currentColor" opacity="0.78">
          {formatDate(first.date)}
        </text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 10} textAnchor="end" fontSize="12" fill="currentColor" opacity="0.78">
          {formatDate(last.date)}
        </text>
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        نمودار فقط تغییرات عددی ثبت‌شده را نمایش می‌دهد و به‌تنهایی تفسیر یا تشخیص پزشکی نیست.
      </p>
    </div>
  );
}
