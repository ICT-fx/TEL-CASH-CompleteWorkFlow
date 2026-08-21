// Libellé de statut adapté au retrait boutique — même statut en base
// (paid → shipped → delivered), texte différent à l'affichage seulement.
// Partagé entre l'admin (admin/orders/[id]) et l'espace client (account/*)
// pour qu'un client en retrait boutique ne voie jamais "Expédiée"/"Livrée".
export function pickupAwareLabel(status: string, isPickup: boolean): string | undefined {
  if (!isPickup) return undefined;
  if (status === 'shipped') return 'Prête à retirer';
  if (status === 'delivered') return 'Retirée';
  return undefined;
}
