// Statut de commande → présentation visuelle (libellé, couleurs, point).
// Source de vérité unique pour StatusBadge et pour tout écran qui a besoin
// de ces couleurs sans passer par le composant React (ex. export CSV plus
// tard). Une teinte = un sens, l'intensité = l'urgence — voir le détail des
// règles dans docs/superpowers/specs/2026-08-21-backoffice-visual-redesign-design.md.

export interface StatusVisual {
  label: string;
  bg: string;
  fg: string;
  dot: string | null; // null uniquement pour le variant "plein" (paid)
  filled: boolean;
}

interface StatusEntry {
  label: string;
  bg: string;
  fg: string;
  dot: string | null;
  filled: boolean;
}

const NEUTRAL: Omit<StatusEntry, 'label'> = { bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false };
const EN_COURS: Omit<StatusEntry, 'label'> = { bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false };
const TERMINE: Omit<StatusEntry, 'label'> = { bg: '#E3F3E9', fg: '#12693F', dot: '#12693F', filled: false };
const PROBLEME: Omit<StatusEntry, 'label'> = { bg: '#FBE9E7', fg: '#B02A1E', dot: '#B02A1E', filled: false };

const STATUS: Record<string, StatusEntry> = {
  pending: { label: 'Panier ouvert', ...NEUTRAL },
  awaiting_payment: { label: 'Paiement en attente', ...NEUTRAL },
  paid: { label: 'Payée · à traiter', bg: '#2F6BFF', fg: '#FFFFFF', dot: null, filled: true },
  supplier_ordered: { label: 'Cmd. fournisseur', ...EN_COURS },
  shipped: { label: 'Expédiée', ...EN_COURS },
  delivered: { label: 'Livrée', ...TERMINE },
  refunded: { label: 'Retour traité', ...NEUTRAL },
  failed: { label: 'Paiement échoué', ...NEUTRAL },
  disputed: { label: 'Litige', ...PROBLEME },
  // cancelled has no single entry — cf. getStatusVisual, dédoublé sur `refunded`.
};

const CANCELLED_UNPAID: StatusEntry = { label: 'Paiement non finalisé', ...NEUTRAL };
const CANCELLED_REFUNDED: StatusEntry = { label: 'Annulée & remboursée', ...PROBLEME, filled: false };
const FALLBACK: StatusEntry = { label: 'Inconnu', bg: '#F1F5F9', fg: '#475569', dot: '#475569', filled: false };

export function getStatusVisual(
  status: string,
  opts?: { refunded?: boolean; labelOverride?: string }
): StatusVisual {
  let entry: StatusEntry;
  if (status === 'cancelled') {
    entry = opts?.refunded ? CANCELLED_REFUNDED : CANCELLED_UNPAID;
  } else {
    entry = STATUS[status] || FALLBACK;
  }
  const label = opts?.labelOverride || entry.label;
  return { label, bg: entry.bg, fg: entry.fg, dot: entry.dot, filled: entry.filled };
}
