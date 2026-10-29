"use client";

import { formatPersianDate } from "@/lib/utils/date-time";

const WIDTH = 560;
const HEIGHT = 160;
const PAD = 8;
const number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 4 });



export default function LabTrendChart({ points = [], unit = null }) {
  const normalized = (Array.isArray(points) ? points : [])
    .map(point => ({ value: Number(point?.value), date: point?.date || null }))
    .filter(point => Number.isFinite(point.value) && point.date && !Number.isNaN(new Date(point.date).getTime()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (normalized.length < 2) return <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">برای نمایش روند عددی، دست‌کم دو نتیجهٔ ثبت‌شده لازم است.</div>;

  const values = normalized.map(point => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.1, 1);
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const start = new Date(first.date).getTime();
  const duration = new Date(last.date).getTime() - start;
  const coordinates = normalized.map((point, index) => ({
    ...point,
    x: PAD + (duration ? (new Date(point.date).getTime() - start) / duration : index / (normalized.length - 1)) * (WIDTH - PAD * 2),
    y: PAD + ((max - point.value) / (max - min)) * (HEIGHT - PAD * 2),
  }));

  return <figure className="min-w-0 rounded-2xl border bg-card p-4">
    <figcaption className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">روند نتایج{unit && <> · <bdi dir="ltr">{unit}</bdi></>}</span><span className="text-xs text-muted-foreground">{number.format(normalized.length)} نتیجه ثبت‌شده</span></figcaption>
    <div dir="ltr" className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
      <div className="flex h-40 flex-col justify-between py-1 text-end text-xs text-muted-foreground" aria-hidden="true">{[max, (max + min) / 2, min].map((value, index) => <span key={index} className="truncate" title={number.format(value)}>{number.format(value)}</span>)}</div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`روند عددی ${normalized.length} نتیجه آزمایش؛ آخرین مقدار ${number.format(last.value)}${unit ? ` ${unit}` : ""}`} className="h-40 w-full overflow-visible text-primary">
        {[0, .5, 1].map(ratio => <line key={ratio} x1={PAD} y1={PAD + ratio * (HEIGHT - PAD * 2)} x2={WIDTH - PAD} y2={PAD + ratio * (HEIGHT - PAD * 2)} stroke="hsl(var(--border))" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />)}
        <polyline points={coordinates.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {coordinates.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="4" fill="currentColor" stroke="hsl(var(--card))" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{`${formatPersianDate(point.date)}: ${number.format(point.value)}${unit ? ` ${unit}` : ""}`}</title></circle>)}
      </svg>
      <div />
      <div className="flex justify-between gap-3 text-xs text-muted-foreground"><span dir="rtl">{formatPersianDate(first.date)}</span><span dir="rtl">{formatPersianDate(last.date)}</span></div>
    </div>
    <p className="mt-5 text-xs leading-6 text-muted-foreground">این نمودار تغییرات عددی ثبت‌شده را نمایش می‌دهد و به‌تنهایی تفسیر یا تشخیص پزشکی نیست.</p>
    <details className="mt-3 border-t pt-2"><summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">مشاهده مقادیر نمودار</summary><div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">تاریخ و مقدار تمام نقاط نمودار</caption><thead><tr className="border-b"><th scope="col" className="py-2 text-start">تاریخ</th><th scope="col" className="py-2 text-end">مقدار{unit && <> ({unit})</>}</th></tr></thead><tbody>{normalized.map((point, index) => <tr key={`${point.date}-${index}`} className="border-b last:border-0"><td className="py-2">{formatPersianDate(point.date)}</td><td className="py-2 text-end tabular-nums">{number.format(point.value)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
