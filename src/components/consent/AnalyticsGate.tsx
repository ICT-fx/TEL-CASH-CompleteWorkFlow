'use client';

// Charge la mesure d'audience UNIQUEMENT si l'utilisateur a consenti :
// Vercel Analytics (<Analytics/>) + tracking maison (page_views via TrafficTracker).
// Avant consentement (ou après refus) → rien n'est chargé. Umami reste géré à
// part dans le layout (sans cookies, exempté).

import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { TrafficTracker } from '@/components/analytics/TrafficTracker';
import { useConsent } from '@/store/useConsent';

export function AnalyticsGate() {
  const load = useConsent((s) => s.load);
  const loaded = useConsent((s) => s.loaded);
  const analytics = useConsent((s) => s.analytics);

  // Hydrate le consentement depuis localStorage au premier rendu client.
  useEffect(() => { load(); }, [load]);

  if (!loaded || !analytics) return null;
  return (
    <>
      <Analytics />
      <TrafficTracker />
    </>
  );
}
