// Dependency-free SVG bar chart — one bar per day, with a readable date axis.
// Used by the Dashboard for the 30-day sales overview. No chart library.

import { buildBarLayout, type BarDatum } from './barLayout';

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
  ariaLabel?: string;
  // Legacy override for the tooltip's value text (e.g. "12 vues" instead of
  // an amount in euros) — kept for callers outside this redesign (admin/stats).
  valueFormatter?: (n: number) => string;
}

export function MiniBarChart({
  data,
  height = 190,
  ariaLabel = 'Ventes des 30 derniers jours',
  valueFormatter,
}: MiniBarChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Aucune donnée</div>;
  }

  const bars = buildBarLayout(data);

  return (
    <svg
      viewBox="0 0 1080 190"
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={ariaLabel}
    >
      <line x1={0} y1={150.5} x2={1080} y2={150.5} stroke="#E4E7EC" strokeWidth={1} />
      <line x1={0} y1={100.5} x2={1080} y2={100.5} stroke="#F1F3F7" strokeWidth={1} />
      <line x1={0} y1={50.5} x2={1080} y2={50.5} stroke="#F1F3F7" strokeWidth={1} />
      {bars.map((b, i) => (
        <g key={b.date}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={b.fill}>
            <title>
              {valueFormatter
                ? `${new Date(b.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} — ${valueFormatter(data[i].total)}`
                : b.tooltip}
            </title>
          </rect>
          {b.showLabel && (
            <text x={b.cx} y={169} textAnchor="middle" fill="#8A93A3" style={{ font: '500 11px Inter, sans-serif' }}>
              {b.dateLabel}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
