// Generic clickable card for list views. Renders as a Link when `href` is set,
// otherwise as a button-like div when `onClick` is set, otherwise a plain card.
// Visual style (white card, 0.5px border, lg radius, hover) lives in the
// `.admin-ui-card` class in globals.css.

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

interface EntityCardProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  padding?: number | string;
  style?: CSSProperties;
}

export function EntityCard({ children, href, onClick, padding = 16, style }: EntityCardProps) {
  const cardStyle: CSSProperties = { padding, ...style };

  if (href) {
    return (
      <Link href={href} className="admin-ui-card" style={cardStyle}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div
        className="admin-ui-card"
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={cardStyle}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="admin-ui-card" style={cardStyle}>
      {children}
    </div>
  );
}
