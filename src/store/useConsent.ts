import { create } from 'zustand';

// Consentement cookies (RGPD/CNIL) — 100 % maison, sans lib externe.
// Stocké en localStorage 6 mois. Tant qu'aucun choix valide n'est présent, la
// mesure d'audience (Vercel Analytics + tracking maison page_views) reste
// DÉSACTIVÉE. Umami (sans cookies) est exempté et n'est pas géré ici.

const KEY = 'tc_cookie_consent';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

interface Persisted { analytics: boolean; ts: number }

interface ConsentStore {
  loaded: boolean;     // hydraté depuis localStorage (client)
  decided: boolean;    // un choix valide (non expiré) existe
  analytics: boolean;  // consentement « mesure d'audience »
  panelOpen: boolean;  // panneau « Personnaliser » déplié
  load: () => void;
  acceptAll: () => void;
  refuseAll: () => void;
  save: (analytics: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  reopen: () => void;  // rouvre la bannière (lien « Gérer les cookies » du footer)
}

function persist(analytics: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ analytics, ts: Date.now() } as Persisted));
  } catch { /* mode privé strict : on ignore */ }
}

export const useConsent = create<ConsentStore>((set) => ({
  loaded: false,
  decided: false,
  analytics: false,
  panelOpen: false,

  load: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        const fresh = typeof p?.ts === 'number' && Date.now() - p.ts < SIX_MONTHS_MS;
        if (fresh) {
          set({ loaded: true, decided: true, analytics: !!p.analytics });
          return;
        }
      }
    } catch { /* JSON cassé / indispo → on redemande le consentement */ }
    set({ loaded: true, decided: false, analytics: false });
  },

  acceptAll: () => { persist(true); set({ decided: true, analytics: true, panelOpen: false }); },
  refuseAll: () => { persist(false); set({ decided: true, analytics: false, panelOpen: false }); },
  save: (analytics) => { persist(analytics); set({ decided: true, analytics, panelOpen: false }); },
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  reopen: () => set({ decided: false, panelOpen: true }),
}));
