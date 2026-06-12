import type { Metadata } from 'next';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  title: 'Nous contacter — TEL & CASH',
  description:
    'Une question sur une commande, un retour ou la garantie ? Contactez l\'équipe TEL & CASH à Angers — réponse sous 24 h ouvrées.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
