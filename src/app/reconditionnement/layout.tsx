import type { Metadata } from 'next';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  title: 'Le reconditionnement — TEL & CASH',
  description:
    'Comment nous reconditionnons vos smartphones : 60 points de contrôle, batterie certifiée ≥ 85 %, grades A/B/C transparents, garantie jusqu\'à 24 mois.',
};

export default function ReconditionnementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
