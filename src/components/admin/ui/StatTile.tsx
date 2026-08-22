// Key figure tile — Vitrine direction (1c): big tabular-nums value, small
// icon pastille top-right, optional delta chip vs. a previous period.

import type { CSSProperties, ReactNode } from 'react';

interface StatTileProps {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  // Variation vs previous period, in percent. Omit when not computable.
  delta?: number | null;
  icon?: ReactNode;
  // Couleur de la pastille d'icône — un sens par teinte (cf. statusVisual.ts),
  // jamais une couleur arbitraire. 'gray' = neutre/informatif (défaut).
  tone?: 'blue' | 'green' | 'amber' | 'gray';
  // 'accent-fill' = la tuile pleine bleue (réservée à UNE seule tuile par
  // écran : celle qui appelle vraiment à l'action, ex. "À expédier").
  variant?: 'default' | 'accent-fill';
  // Legacy: arbitrary hex for the value's text color — kept only for callers
  // outside this redesign (admin/stats). New /admin dashboard code should use
  // `tone` instead.
  accent?: string;
  style?: CSSProperties;
}

const TONE_BG: Record<NonNullable<StatTileProps['tone']>, string> = {
  blue: '#EEF3FF',
  green: '#E3F3E9',
  amber: '#F6ECD8',
  gray: '#EFF1F5',
};
const TONE_DOT: Record<NonNullable<StatTileProps['tone']>, string> = {
  blue: '#2F6BFF',
  green: '#12693F',
  amber: '#B0781A',
  gray: '#8A93A3',
};

export function StatTile({ value, label, hint, delta, icon, tone = 'gray', variant = 'default', accent, style }: StatTileProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && (delta as number) >= 0;
  const filled = variant === 'accent-fill';

  return (
    <div
      style={{
        background: filled ? '#2F6BFF' : '#FFFFFF',
        borderRadius: 14,
        padding: '18px 20px 20px',
        boxShadow: filled
          ? '0 2px 12px rgba(47,107,255,.28)'
          : '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ font: '500 12px Inter, sans-serif', color: filled ? 'rgba(255,255,255,.82)' : '#6B7280' }}>
          {label}
        </div>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: filled ? 'rgba(255,255,255,.18)' : TONE_BG[tone],
              color: filled ? '#FFFFFF' : TONE_DOT[tone],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          font: '700 34px/1.05 Inter, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-.03em',
          color: filled ? '#FFFFFF' : accent || '#111827',
          marginTop: 12,
        }}
      >
        {value}
      </div>
      {(hint || hasDelta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
          {hasDelta && (
            <span
              style={{
                font: '600 11.5px/1.5 Inter, sans-serif',
                color: positive ? '#12693F' : '#B02A1E',
                background: positive ? '#E3F3E9' : '#FBE9E7',
                padding: '2px 7px',
                borderRadius: 6,
              }}
            >
              {positive ? '+' : ''}{(delta as number).toFixed(0)} %
            </span>
          )}
          {hint && (
            <span style={{ font: '400 11.5px/1.4 Inter, sans-serif', color: filled ? 'rgba(255,255,255,.82)' : '#9CA3AF' }}>
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
