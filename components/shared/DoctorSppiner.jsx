/**
 * Stethoscope spinner — a slender stethoscope outline with a bright arc
 * traveling continuously around it, from one eartip through the tube,
 * around the chest piece, and out the other side. Ultra-refined variant:
 * thinner strokes, softer curves, wider dash gap.
 *
 * @param {{
 *   size?: number,
 *   label?: string,
 *   className?: string,
 * }} props
 */
export default function DoctorSppiner({
  size = 40,
  label = "در حال بارگذاری...",
  className,
}) {
  // Slender stethoscope, symmetric on x = 16.
  // Left eartip → headset tube down → junction → main tube → chest piece
  // (full circle) → main tube up → right headset tube → right eartip.
  const stethoscopePath =
    "M 10.5 4" +
    " Q 10.5 10.5 16 12.5" +
    " L 16 19" +
    " A 3.2 3.2 0 0 1 16 25.4" +
    " A 3.2 3.2 0 0 1 16 19" +
    " L 16 12.5" +
    " Q 21.5 10.5 21.5 4";

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
        strokeWidth={size <= 20 ? 0.7 : 1}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Dim track — full stethoscope outline */}
        <g opacity="0.12">
          {/* Eartips */}
          <circle cx="10.5" cy="4" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="21.5" cy="4" r="1.1" fill="currentColor" stroke="none" />
          {/* Full outline */}
          <path d={stethoscopePath} />
        </g>

        {/* Traveling bright arc */}
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
          animation: stetho-pulse-travel 1.7s linear infinite;
        }
        @keyframes stetho-pulse-travel {
          to { stroke-dashoffset: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .stetho-pulse {
            animation: stetho-pulse-fade 1.8s ease-in-out infinite;
          }
          @keyframes stetho-pulse-fade {
            0%, 100% { opacity: 0.25; }
            50%     { opacity: 1; }
          }
        }
      `}</style>
    </span>
  );
}
