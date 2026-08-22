import { describe, it, expect } from 'vitest';
import { getStatusVisual } from './statusVisual';

describe('getStatusVisual', () => {
  it('paid is the only filled/action state', () => {
    const v = getStatusVisual('paid');
    expect(v).toEqual({ label: 'Payée · à traiter', bg: '#2F6BFF', fg: '#FFFFFF', dot: null, filled: true });
  });

  it('pending reads as "Panier ouvert", neutral tint', () => {
    const v = getStatusVisual('pending');
    expect(v).toEqual({ label: 'Panier ouvert', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('awaiting_payment reads as "Paiement en attente", same neutral tint as pending', () => {
    const v = getStatusVisual('awaiting_payment');
    expect(v).toEqual({ label: 'Paiement en attente', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('supplier_ordered and shipped share the "en cours" blue tint', () => {
    expect(getStatusVisual('supplier_ordered')).toEqual({ label: 'Cmd. fournisseur', bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false });
    expect(getStatusVisual('shipped')).toEqual({ label: 'Expédiée', bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false });
  });

  it('shipped with labelOverride "Prête à retirer" keeps the same colors, different text', () => {
    const v = getStatusVisual('shipped', { labelOverride: 'Prête à retirer' });
    expect(v).toEqual({ label: 'Prête à retirer', bg: '#E7EEFF', fg: '#1B4ACB', dot: '#2F6BFF', filled: false });
  });

  it('delivered is green "terminé", labelOverride swaps to "Retirée" for pickup', () => {
    expect(getStatusVisual('delivered')).toEqual({ label: 'Livrée', bg: '#E3F3E9', fg: '#12693F', dot: '#12693F', filled: false });
    expect(getStatusVisual('delivered', { labelOverride: 'Retirée' })).toEqual({ label: 'Retirée', bg: '#E3F3E9', fg: '#12693F', dot: '#12693F', filled: false });
  });

  it('refunded (the "Retour" DB status, not a cancelled order) and failed are neutral', () => {
    expect(getStatusVisual('refunded')).toEqual({ label: 'Retour traité', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
    expect(getStatusVisual('failed')).toEqual({ label: 'Paiement échoué', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('disputed is the red "problème" tint', () => {
    expect(getStatusVisual('disputed')).toEqual({ label: 'Litige', bg: '#FBE9E7', fg: '#B02A1E', dot: '#B02A1E', filled: false });
  });

  it('cancelled without refunded=true reads as "Paiement non finalisé", neutral', () => {
    expect(getStatusVisual('cancelled')).toEqual({ label: 'Paiement non finalisé', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
    expect(getStatusVisual('cancelled', { refunded: false })).toEqual({ label: 'Paiement non finalisé', bg: '#F0F0ED', fg: '#6B6B63', dot: '#9A9A90', filled: false });
  });

  it('cancelled with refunded=true reads as "Annulée & remboursée", red problem tint', () => {
    expect(getStatusVisual('cancelled', { refunded: true })).toEqual({ label: 'Annulée & remboursée', bg: '#FBE9E7', fg: '#B02A1E', dot: '#B02A1E', filled: false });
  });

  it('refunded has no effect on a non-cancelled status', () => {
    expect(getStatusVisual('paid', { refunded: true })).toEqual({ label: 'Payée · à traiter', bg: '#2F6BFF', fg: '#FFFFFF', dot: null, filled: true });
  });

  it('unknown status falls back to a gray "Inconnu" state', () => {
    expect(getStatusVisual('bogus')).toEqual({ label: 'Inconnu', bg: '#F1F5F9', fg: '#475569', dot: '#475569', filled: false });
  });
});
