// Order status → French label + color. Single source of truth for order
// statuses across Commandes, Clients and the Dashboard.

import type { CSSProperties } from 'react';

interface StatusStyle {
  label: string;
  bg: string;
  fg: string;
}

const STATUS: Record<string, StatusStyle> = {
  pending: { label: 'En attente', bg: '#fef3c7', fg: '#b45309' },
  awaiting_payment: { label: 'Paiement différé', bg: '#fef3c7', fg: '#b45309' },
  paid: { label: 'Payée', bg: '#dbeafe', fg: '#1d4ed8' },
  failed: { label: 'Échouée', bg: '#fee2e2', fg: '#b91c1c' },
  shipped: { label: 'Expédiée', bg: '#ede9fe', fg: '#6d28d9' },
  delivered: { label: 'Livrée', bg: '#dcfce7', fg: '#15803d' },
  refunded: { label: 'Retour', bg: '#fed7aa', fg: '#9a3412' },
  disputed: { label: 'Litige', bg: '#fee2e2', fg: '#b91c1c' },
  cancelled: { label: 'Annulée', bg: '#fee2e2', fg: '#b91c1c' },
};

const FALLBACK: StatusStyle = { label: 'Inconnu', bg: '#f1f5f9', fg: '#475569' };

// Exposed so other views can read the canonical label without the badge.
export function statusLabelFr(status: string): string {
  return (STATUS[status] || FALLBACK).label;
}

interface StatusBadgeProps {
  status: string;
  // Optional label override (e.g. "Panier" for an unpaid order).
  label?: string;
  style?: CSSProperties;
}

export function StatusBadge({ status, label, style }: StatusBadgeProps) {
  const s = STATUS[status] || FALLBACK;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: s.bg,
        color: s.fg,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '3px 9px',
        borderRadius: 6,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: '50%', background: s.fg }}
      />
      {label || s.label}
    </span>
  );
}
