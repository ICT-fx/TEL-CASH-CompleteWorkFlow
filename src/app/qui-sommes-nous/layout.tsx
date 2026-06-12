import type { Metadata } from 'next';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  title: 'Qui sommes-nous ? — TEL & CASH',
  description:
    'TEL & CASH, expert français du smartphone reconditionné à Angers : une vraie boutique, des appareils testés et certifiés, garantis 24 mois.',
};

export default function QuiSommesNousLayout({ children }: { children: React.ReactNode }) {
  return children;
}
