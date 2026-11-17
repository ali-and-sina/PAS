"use client";

import { generateQrMatrix } from "@/lib/qr/qr-code";

export default function ReferralQrImage({ value }) {
  const matrix = generateQrMatrix(value);
  const quietZone = 4;
  const dimension = matrix.length + quietZone * 2;
  const path = [];

  // Combine adjacent dark modules on each row into one SVG sub-path. This avoids
  // creating hundreds of individual <rect> nodes for every issued QR token.
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      const left = start + quietZone;
      const top = y + quietZone;
      const runWidth = x - start;
      path.push(`M${left} ${top}h${runWidth}v1H${left}z`);
    }
  });

  return (
    <svg
      viewBox={`0 0 ${dimension} ${dimension}`}
      role="img"
      aria-label="کد پذیرش ارجاع"
      className="mx-auto block aspect-square w-full max-w-[16.25rem] rounded-xl border bg-white p-3"
      shapeRendering="crispEdges"
    >
      <rect width={dimension} height={dimension} fill="#fff" />
      <path d={path.join("")} fill="#111827" />
    </svg>
  );
}
