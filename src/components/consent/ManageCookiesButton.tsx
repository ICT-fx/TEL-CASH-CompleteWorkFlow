'use client';

// Lien « Gérer les cookies » (footer) : rouvre la bannière de consentement pour
// changer d'avis à tout moment.

import { useConsent } from '@/store/useConsent';

export function ManageCookiesButton({ className }: { className?: string }) {
  const reopen = useConsent((s) => s.reopen);
  return (
    <button type="button" onClick={reopen} className={className}>
      Gérer les cookies
    </button>
  );
}
