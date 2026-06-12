import type { Metadata } from 'next';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  title: 'Nos engagements — TEL & CASH',
  description:
    'Garantie 24 mois, retour 30 jours, reconditionnement certifié, SAV 100 % français : les 5 engagements TEL & CASH.',
};

export default function EngagementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
