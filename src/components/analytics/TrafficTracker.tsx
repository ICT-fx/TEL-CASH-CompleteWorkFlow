'use client';

// Tracking de trafic maison : envoie une page vue à /api/track à chaque
// changement de route. Anonyme (visitor_id en localStorage, session_id en
// sessionStorage), non bloquant (sendBeacon), et silencieux en cas d'échec.
// Ne traque jamais l'espace admin.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readOrCreate(storage: Storage, key: string): string {
  let v = storage.getItem(key);
  if (!v) {
    v = uuid();
    storage.setItem(key, v);
  }
  return v;
}

export function TrafficTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    try {
      const visitorId = readOrCreate(window.localStorage, 'tc_vid');
      const sessionId = readOrCreate(window.sessionStorage, 'tc_sid');
      const payload = JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        visitorId,
        sessionId,
      });
      // Non bloquant : sendBeacon part en arrière-plan sans retarder l'affichage.
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/track', {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => { /* silencieux */ });
      }
    } catch {
      /* localStorage indispo (mode privé strict) → on n'enregistre rien, sans casser */
    }
  }, [pathname]);

  return null;
}
