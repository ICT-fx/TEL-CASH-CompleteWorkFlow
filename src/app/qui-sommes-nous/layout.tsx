import type { Metadata } from 'next';
import { pageSocial } from '@/lib/seoOg';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  alternates: { canonical: '/qui-sommes-nous' },
  title: 'Qui sommes-nous ? — TEL & CASH Angers',
  description:
    'TEL & CASH, expert français du smartphone reconditionné à Angers : une vraie boutique, des appareils testés et certifiés, garantis 24 mois.',
  ...pageSocial('/qui-sommes-nous', 'Qui sommes-nous ? — TEL & CASH Angers', 'TEL & CASH, expert français du smartphone reconditionné à Angers : une vraie boutique, des appareils testés et certifiés, garantis 24 mois.'),
};

export default function QuiSommesNousLayout({ children }: { children: React.ReactNode }) {
  return children;
}
