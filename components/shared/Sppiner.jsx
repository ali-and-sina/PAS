/**
 * Public spinner — a slender ECG pulse line with a bright segment
 * traveling continuously along it, like a signal moving through a
 * heart monitor. Universal and role-agnostic: works for any route,
 * button, or overlay where a healthcare-appropriate, ultra-refined
 * loader is wanted.
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
  // ECG pulse — flat line, single clean spike, flat line.
  // Symmetric on x = 16, spike centered.
  const pulsePath =
    "M 3 16" + " L 10 16" + " L 12 10" + " L 15 23" + " L 18 16" + " L 29 16";

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
        {/* Dim track — full pulse line */}
        <path d={pulsePath} opacity="0.12" />

        {/* Traveling bright arc */}
        <path
          d={pulsePath}
          pathLength="1"
          strokeDasharray="0.25 0.75"
          className="public-pulse"
        />
      </svg>

      <span className="sr-only">{label}</span>

      <style>{`
        .public-pulse {
          animation: public-pulse-travel 1.8s linear infinite;
        }
        @keyframes public-pulse-travel {
          to { stroke-dashoffset: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .public-pulse {
            animation: public-pulse-fade 1.8s ease-in-out infinite;
          }
          @keyframes public-pulse-fade {
            0%, 100% { opacity: 0.25; }
            50%     { opacity: 1; }
          }
        }
      `}</style>
    </span>
  );
}
