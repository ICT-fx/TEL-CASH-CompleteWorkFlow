// Generic colored badge — dark text on a soft tint of the same hue.

import type { CSSProperties, ReactNode } from 'react';

export type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const VARIANTS: Record<BadgeVariant, { bg: string; fg: string }> = {
  info: { bg: '#dbeafe', fg: '#1d4ed8' },
  success: { bg: '#dcfce7', fg: '#15803d' },
  warning: { bg: '#fef3c7', fg: '#b45309' },
  danger: { bg: '#fee2e2', fg: '#b91c1c' },
  neutral: { bg: '#f1f5f9', fg: '#475569' },
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  style?: CSSProperties;
}

export function Badge({ variant = 'neutral', children, style }: BadgeProps) {
  const c = VARIANTS[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: c.bg,
        color: c.fg,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 6,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
