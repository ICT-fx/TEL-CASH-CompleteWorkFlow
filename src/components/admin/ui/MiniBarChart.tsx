// Dependency-free SVG bar chart — one bar per day. Used by the Dashboard
// for the 30-day sales overview. No chart library involved.

interface Point {
  date: string;  // YYYY-MM-DD
  total: number;
}

interface MiniBarChartProps {
  data: Point[];
  height?: number;
}

export function MiniBarChart({ data, height = 140 }: MiniBarChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucune donnée</div>;
  }

  const max = Math.max(1, ...data.map((d) => d.total));
  const n = data.length;
  const W = 600;
  const H = height;
  const gap = 3;
  const barW = (W - gap * (n - 1)) / n;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block' }}
      role="img"
      aria-label="Ventes des 30 derniers jours"
    >
      {data.map((d, i) => {
        const h = d.total > 0 ? Math.max(2, (d.total / max) * (H - 4)) : 0;
        const x = i * (barW + gap);
        const label = new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        return (
          <rect
            key={d.date}
            x={x}
            y={H - h}
            width={barW}
            height={h}
            rx={2}
            fill={d.total > 0 ? '#3b82f6' : '#eef2f6'}
          >
            <title>{`${label} — ${d.total.toFixed(2)} €`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
