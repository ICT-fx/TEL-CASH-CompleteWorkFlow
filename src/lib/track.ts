// Mesure des clics clés (parcours d'achat) via Umami : sans cookies, exempté de
// consentement → compte TOUS les visiteurs, y compris ceux qui refusent les
// cookies. Les données remontent dans le back-office (Statistiques > Parcours
// d'achat). Silencieux si Umami n'est pas chargé (bloqueur de pub, etc.).
//
// Clics simples : préférer l'attribut data-umami-event="nom" (+ data-umami-event-cle="valeur")
// directement sur le bouton / lien. Cette fonction sert aux événements sans clic
// (ex. arrivée sur le paiement, paiement réussi).

type UmamiData = Record<string, string | number>;

declare global {
  interface Window {
    umami?: { track: (event: string, data?: UmamiData) => void };
  }
}

export function track(event: string, data?: UmamiData): void {
  try {
    if (typeof window === 'undefined') return;
    // Le script Umami se charge après l'affichage : on réessaie quelques fois.
    let tries = 0;
    const send = () => {
      if (window.umami?.track) {
        window.umami.track(event, data);
      } else if (tries++ < 10) {
        setTimeout(send, 500);
      }
    };
    send();
  } catch {
    /* jamais bloquant */
  }
}

// Noms d'événements (une seule source, réutilisée par le back-office).
export const FUNNEL_EVENTS = [
  { key: 'hero-cta', label: 'Clic « Trouver mon smartphone »' },
  { key: 'hero-prix', label: 'Clic sur la carte prix du héros' },
  { key: 'accueil-produit', label: "Clic sur un téléphone de l'accueil" },
  { key: 'ajout-panier', label: 'Ajout au panier' },
  { key: 'panier-commander', label: 'Clic « Commander » au panier' },
  { key: 'checkout-ouvert', label: 'Arrivée sur le paiement' },
  { key: 'paiement-reussi', label: 'Paiement réussi' },
] as const;
