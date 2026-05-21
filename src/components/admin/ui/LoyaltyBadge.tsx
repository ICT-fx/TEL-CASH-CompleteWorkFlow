// Customer loyalty tier derived from total amount spent.
//   Nouveau  < 300 €      (blue)
//   Fidèle   300–999 €    (green)
//   VIP      ≥ 1000 €     (amber)

import type { CSSProperties } from 'react';

export type LoyaltySegment = 'nouveau' | 'fidele' | 'vip';

const SEGMENTS: Record<LoyaltySegment, { label: string; bg: string; fg: string }> = {
  nouveau: { label: 'Nouveau', bg: '#dbeafe', fg: '#1d4ed8' },
  fidele: { label: 'Fidèle', bg: '#dcfce7', fg: '#15803d' },
  vip: { label: 'VIP', bg: '#fef3c7', fg: '#b45309' },
};

// Shared with the Clients list segment filter.
export function getLoyaltySegment(totalSpent: number): LoyaltySegment {
  if (totalSpent >= 1000) return 'vip';
  if (totalSpent >= 300) return 'fidele';
  return 'nouveau';
}

export function loyaltySegmentLabel(segment: LoyaltySegment): string {
  return SEGMENTS[segment].label;
}

interface LoyaltyBadgeProps {
  totalSpent: number;
  style?: CSSProperties;
}

export function LoyaltyBadge({ totalSpent, style }: LoyaltyBadgeProps) {
  const s = SEGMENTS[getLoyaltySegment(totalSpent)];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: s.bg,
        color: s.fg,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '2px 9px',
        borderRadius: 999,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {s.label}
    </span>
  );
}
