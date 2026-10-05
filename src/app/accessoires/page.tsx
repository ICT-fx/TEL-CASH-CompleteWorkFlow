import { permanentRedirect } from 'next/navigation';

// Le listing des accessoires est désormais unifié avec celui des téléphones,
// sous /products?category=accessoires (mêmes cartes, même style). On redirige
// l'ancienne URL pour ne garder qu'un seul listing canonique.
export default function AccessoiresRedirect() {
  permanentRedirect('/products?category=accessoires');
}
