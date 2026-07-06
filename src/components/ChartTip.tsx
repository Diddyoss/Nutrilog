const HALF_W = 34;
const TIP_H = 30;

/**
 * Value bubble for tapped chart points, rendered inside the chart's SVG.
 * Clamped horizontally so it never leaves the viewBox.
 */
export function ChartTip({
  x,
  y,
  primary,
  secondary,
  chartWidth,
}: {
  /** Anchor point (SVG coords) the tip floats above. */
  x: number;
  y: number;
  primary: string;
  secondary: string;
  chartWidth: number;
}) {
  const cx = Math.min(Math.max(x, HALF_W + 2), chartWidth - HALF_W - 2);
  const ty = Math.max(2, y - TIP_H - 8);
  return (
    <g className="chart-tip" transform={`translate(${cx - HALF_W}, ${ty})`} pointerEvents="none">
      <rect width={HALF_W * 2} height={TIP_H} rx="6" className="chart-tip-bg" />
      <text x={HALF_W} y="13" className="chart-tip-val">
        {primary}
      </text>
      <text x={HALF_W} y="24" className="chart-tip-date">
        {secondary}
      </text>
    </g>
  );
}
