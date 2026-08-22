// Round avatar with initials — monochrome background (the old 8-color random
// palette was pure visual noise, no information: two clients rarely share a
// color anyway, and inconsistent hues made lists feel cluttered).

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  size?: number;
}

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

export function Avatar({ name, email, size = 40 }: AvatarProps) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#EFEFEC',
        color: '#6B6B63',
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
