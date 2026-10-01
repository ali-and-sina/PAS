/**
 * Laboratory spinner — a slender Erlenmeyer flask outline with a bright
 * arc traveling continuously around it. Ultra-refined variant: narrow
 * neck, tall body, hairline strokes, soft joins.
 *
 * @param {{ size?: number, label?: string, className?: string }} props
 */
export default function LabSpinner({
  size = 40,
  label = "در حال بارگذاری...",
  className,
}) {
  // Very slender Erlenmeyer, symmetric on x = 16.
  const flaskPath =
    "M 13.5 5" +
    " L 18.5 5" +
    " L 18.5 12" +
    " Q 18.5 14.2 19.6 16.2" +
    " L 25.6 27.4" +
    " Q 26.2 28.6 24.8 28.6" +
    " L 7.2 28.6" +
    " Q 5.8 28.6 6.4 27.4" +
    " L 12.4 16.2" +
    " Q 13.5 14.2 13.5 12" +
    " Z";

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
        {/* Dim track */}
        <path d={flaskPath} opacity="0.12" />

        {/* Dim liquid level */}
        <line
          x1="10.5"
          y1="21.5"
          x2="21.5"
          y2="21.5"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeLinecap="round"
          opacity="0.1"
        />

        {/* Traveling bright arc */}
        <path
          d={flaskPath}
          pathLength="1"
          strokeDasharray="0.2 0.8"
          className="lab-pulse"
        />
      </svg>

      <span className="sr-only">{label}</span>

      <style>{`
        .lab-pulse {
          animation: lab-pulse-travel 1.8s linear infinite;
        }
        @keyframes lab-pulse-travel {
          to { stroke-dashoffset: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lab-pulse {
            animation: lab-pulse-fade 1.8s ease-in-out infinite;
          }
          @keyframes lab-pulse-fade {
            0%, 100% { opacity: 0.25; }
            50%     { opacity: 1; }
          }
        }
      `}</style>
    </span>
  );
}
