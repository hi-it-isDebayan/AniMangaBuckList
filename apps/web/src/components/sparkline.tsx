/**
 * Tiny dependency-free line chart used for MangaBaka popularity/rank trends.
 * Render with the semantic `text-*` class you want the stroke to inherit.
 */
export function Sparkline({
  values,
  width = 320,
  height = 64,
  invert = false,
  className,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** When true, smaller values plot higher (used for popularity rank). */
  invert?: boolean;
  className?: string;
  label?: string;
}) {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const padX = 4;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = innerW / (points.length - 1);

  const coords = points.map((v, i) => {
    const t = (v - min) / span;
    const norm = invert ? t : 1 - t;
    return { x: padX + i * stepX, y: padY + norm * innerH };
  });

  const line = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;
  const last = coords[coords.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? "Trend"}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkline-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r="2.5" fill="currentColor" />
    </svg>
  );
}
