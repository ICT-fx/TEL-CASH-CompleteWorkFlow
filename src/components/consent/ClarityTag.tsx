'use client';

// Microsoft Clarity — monté par AnalyticsGate SEULEMENT après consentement.
// Envoie le signal de consentement (Consent Mode v2) : mesure autorisée,
// publicité refusée. Ne s'exécute jamais dans l'espace admin.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CLARITY_PROJECT_ID } from '@/lib/clarity';

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window { clarity?: ClarityFn }
}

export function ClarityTag() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  useEffect(() => {
    if (!CLARITY_PROJECT_ID || isAdmin) return;
    if (document.getElementById('ms-clarity')) return;
    const w = window;
    w.clarity =
      w.clarity ||
      (function (...args: unknown[]) {
        (w.clarity!.q = w.clarity!.q || []).push(args);
      } as ClarityFn);
    w.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    const s = document.createElement('script');
    s.id = 'ms-clarity';
    s.async = true;
    s.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
    document.head.appendChild(s);
  }, [isAdmin]);

  return null;
}
