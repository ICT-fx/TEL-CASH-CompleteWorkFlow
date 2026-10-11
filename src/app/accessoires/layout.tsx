import type { Metadata } from 'next';
import { pageSocial } from '@/lib/seoOg';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  title: 'Accessoires — coques, verres trempés, chargeurs | TEL & CASH',
  description:
    'Protégez et équipez votre smartphone reconditionné : coques, verres trempés, chargeurs et câbles certifiés, expédiés depuis Angers.',
  ...pageSocial('/accessoires', 'Accessoires — coques, verres trempés, chargeurs | TEL & CASH', 'Protégez et équipez votre smartphone reconditionné : coques, verres trempés, chargeurs et câbles certifiés, expédiés depuis Angers.'),
};

export default function AccessoiresLayout({ children }: { children: React.ReactNode }) {
  return children;
}
