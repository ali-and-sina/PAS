"use client";

import { useMemo } from "react";
import { generateQrMatrix } from "@/lib/qr/qr-code";

/** Local QR rendering: the token URL is never sent to a third-party image service. */
export default function QRCodeSvg({ value, size = 224, title = "کد پذیرش" }) {
  const matrix = useMemo(() => {
    if (!value) return null;
    try { return generateQrMatrix(value); } catch { return null; }
  }, [value]);

  if (!matrix) return <p className="max-w-xs text-sm text-muted-foreground">تصویر کد ساخته نشد؛ نشانی یا متن کد را کپی کنید.</p>;
  const quietZone = 4;
  const viewSize = matrix.length + quietZone * 2;
  const cells = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) cells.push(<rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" />);
  }));

  return <svg role="img" aria-label={title} viewBox={`0 0 ${viewSize} ${viewSize}`} width={size} height={size} shapeRendering="crispEdges" className="max-w-full rounded-lg border bg-white p-1">
    <rect width={viewSize} height={viewSize} fill="#fff" />
    <g fill="#111827">{cells}</g>
  </svg>;
}
