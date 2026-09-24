/**
 * Stethoscope spinner.
 *
 * A single continuous path traces the entire stethoscope — left eartip,
 * down through the headset, down the main tube, all the way around the
 * chest piece, back up the tube, and up to the right eartip. A bright
 * arc travels along this path using strokeDasharray + dashoffset, so the
 * "pulse" appears to flow from one eartip, through the instrument, and
 * out the other side — the same chasing motion as a classic circular
 * spinner, just traced along a stethoscope outline.
 *
 * Self-contained. Drop it into any loading.js, Suspense fallback, or
 * button without any additional setup:
 *
 *   import Spinner from "@/components/shared/Spinner";
 *   <Spinner size={40} />
 *   <Spinner size={16} />  // inline in a button
 *
 * @param {{
 *   size?: number,
 *   label?: string,
 *   className?: string,
 * }} props
 */
export default function Spinner({
  size = 40,
  label = "در حال بارگذاری...",
  className,
}) {
  // Single continuous path across the entire stethoscope.
  // Coordinates are in a 32×32 viewBox, centered on x = 16.
  const stethoscopePath =
    "M 10 3" +
    " Q 10 10 16 12" + // left headset tube → junction
    " L 16 19" + // main tube down to chest piece
    " A 3.5 3.5 0 0 1 16 26" + // chest piece, clockwise via right
    " A 3.5 3.5 0 0 1 16 19" + // chest piece, clockwise via left
    " L 16 12" + // main tube back up
    " Q 22 10 22 3"; // right headset tube → eartip

  return (
    <span
      role="status"
      aria-live="polite"
      className={className}
      style={{ display: "inline-flex", color: "hsl(var(--primary))" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={size <= 20 ? 1.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Dim track — full stethoscope outline, always visible */}
        <g opacity="0.15">
          {/* Ear tips */}
          <circle cx="10" cy="3" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="22" cy="3" r="1.4" fill="currentColor" stroke="none" />
          {/* Full outline */}
          <path d={stethoscopePath} />
        </g>

        {/* Traveling bright arc — the chasing pulse */}
        <path
          d={stethoscopePath}
          pathLength="1"
          strokeDasharray="0.2 0.8"
          className="stetho-pulse"
        />
      </svg>

      <span className="sr-only">{label}</span>

      <style>{`
        .stetho-pulse {
          animation: stetho-pulse-travel 1.6s linear infinite;
        }
        @keyframes stetho-pulse-travel {
          to {
            stroke-dashoffset: -1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .stetho-pulse {
            animation: stetho-pulse-fade 1.8s ease-in-out infinite;
          }
          @keyframes stetho-pulse-fade {
            0%, 100% { opacity: 0.3; }
            50%     { opacity: 1; }
          }
        }
      `}</style>
    </span>
  );
}
