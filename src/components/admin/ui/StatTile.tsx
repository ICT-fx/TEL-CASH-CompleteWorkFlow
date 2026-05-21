// Key figure tile — large number on top, small label underneath.
// Optional hint line and a variation chip vs a previous period.

import type { CSSProperties, ReactNode } from 'react';

interface StatTileProps {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  // Variation vs previous period, in percent. Omit when not computable.
  delta?: number | null;
  // Accent color for the value (defaults to slate-900).
  accent?: string;
  icon?: ReactNode;
  style?: CSSProperties;
}

export function StatTile({ value, label, hint, delta, accent, icon, style }: StatTileProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && (delta as number) >= 0;

  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #e2e8f0',
        borderRadius: 12,
        padding: '16px 18px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</div>
        {icon && <div style={{ color: '#94a3b8', display: 'flex' }}>{icon}</div>}
      </div>
      <div
        style={{
          fontSize: '1.6rem',
          fontWeight: 500,
          color: accent || '#0f172a',
          lineHeight: 1.15,
          marginTop: 6,
        }}
      >
        {value}
      </div>
      {(hint || hasDelta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          {hasDelta && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 500,
                color: positive ? '#15803d' : '#b91c1c',
                background: positive ? '#dcfce7' : '#fee2e2',
                padding: '1px 6px',
                borderRadius: 5,
              }}
            >
              {positive ? '+' : ''}{(delta as number).toFixed(0)} %
            </span>
          )}
          {hint && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{hint}</span>}
        </div>
      )}
    </div>
  );
}
