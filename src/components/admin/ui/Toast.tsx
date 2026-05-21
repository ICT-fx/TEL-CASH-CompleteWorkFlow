'use client';

// Minimal self-contained toast for admin pages — no external dependency.
// Usage:
//   const { showToast, toastElement } = useToast();
//   <button onClick={() => showToast('Bientôt disponible')}>…</button>
//   {toastElement}

import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);

  const toastElement = message ? (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#0f172a',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: 10,
        fontSize: '0.85rem',
        fontWeight: 500,
        zIndex: 100,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
      }}
    >
      {message}
    </div>
  ) : null;

  return { showToast, toastElement };
}
