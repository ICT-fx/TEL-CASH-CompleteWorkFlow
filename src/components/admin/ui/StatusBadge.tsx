// Order status → visual presentation. Thin React wrapper around the pure
// mapping in statusVisual.ts (unit-tested there) — this file only renders.

import type { CSSProperties } from 'react';
import { getStatusVisual } from './statusVisual';

// Exposed so other views can read the canonical label without the badge.
export function statusLabelFr(status: string, refunded?: boolean): string {
  return getStatusVisual(status, { refunded }).label;
}

interface StatusBadgeProps {
  status: string;
  // Optional label override (e.g. "Prête à retirer" / "Retirée" for pickup).
  label?: string;
  // Only meaningful when status === 'cancelled': true = payée puis
  // remboursée (rouge, problème) ; false/omis = jamais payée (gris, neutre).
  refunded?: boolean;
  style?: CSSProperties;
}

export function StatusBadge({ status, label, refunded, style }: StatusBadgeProps) {
  const v = getStatusVisual(status, { refunded, labelOverride: label });
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: v.bg,
        color: v.fg,
        fontSize: '0.75rem',
        fontWeight: v.filled ? 600 : 500,
        padding: '3px 9px',
        borderRadius: 6,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {v.dot && (
        <span
          aria-hidden
          style={{ width: 6, height: 6, borderRadius: '50%', background: v.dot }}
        />
      )}
      {v.label}
    </span>
  );
}
