// Round avatar with initials and a soft background color derived from the name.
// Shared by the Clients, Commandes and Dashboard sections.

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  size?: number;
}

// Soft background + readable dark foreground pairs (same hue family).
const PALETTE: { bg: string; fg: string }[] = [
  { bg: '#dbeafe', fg: '#1d4ed8' }, // blue
  { bg: '#dcfce7', fg: '#15803d' }, // green
  { bg: '#fef3c7', fg: '#b45309' }, // amber
  { bg: '#fce7f3', fg: '#be185d' }, // pink
  { bg: '#e0e7ff', fg: '#4338ca' }, // indigo
  { bg: '#ccfbf1', fg: '#0f766e' }, // teal
  { bg: '#ffedd5', fg: '#c2410c' }, // orange
  { bg: '#ede9fe', fg: '#6d28d9' }, // violet
];

function getInitials(name?: string | null, email?: string | null): string {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const e = (email || '').trim();
  return e ? e.slice(0, 2).toUpperCase() : '?';
}

function paletteIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export function Avatar({ name, email, size = 40 }: AvatarProps) {
  const seed = (name || email || '?').toLowerCase();
  const { bg, fg } = PALETTE[paletteIndex(seed)];

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        fontSize: Math.round(size * 0.38),
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {getInitials(name, email)}
    </div>
  );
}
