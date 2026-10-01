/**
 * Patient spinner — a slender heart outline with a bright pulse
 * traveling continuously around it. Ultra-refined variant: narrow
 * silhouette, hairline strokes, elongated point.
 *
 * @param {{ size?: number, label?: string, className?: string }} props
 */
export default function PatientSpinner({
  size = 40,
  label = "در حال بارگذاری...",
  className,
}) {
  // Slender heart, symmetric on x = 16.
  // Wider shoulders, deeper point, narrower waist than a classic heart.
  const heartPath =
    "M 16 27.5" +
    " C 5.5 19, 4.5 11.5, 10.5 9" +
    " C 14 7.8, 16 11, 16 13.5" +
    " C 16 11, 18 7.8, 21.5 9" +
    " C 27.5 11.5, 26.5 19, 16 27.5" +
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
        <path d={heartPath} opacity="0.12" />

        {/* Traveling bright arc */}
        <path
          d={heartPath}
          pathLength="1"
          strokeDasharray="0.2 0.8"
          className="patient-pulse"
        />
      </svg>

      <span className="sr-only">{label}</span>

      <style>{`
        .patient-pulse {
          animation: patient-pulse-travel 2s linear infinite;
        }
        @keyframes patient-pulse-travel {
          to { stroke-dashoffset: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .patient-pulse {
            animation: patient-pulse-fade 1.8s ease-in-out infinite;
          }
          @keyframes patient-pulse-fade {
            0%, 100% { opacity: 0.25; }
            50%     { opacity: 1; }
          }
        }
      `}</style>
    </span>
  );
}
