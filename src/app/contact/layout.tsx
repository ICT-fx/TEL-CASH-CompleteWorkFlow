import type { Metadata } from 'next';
import { pageSocial } from '@/lib/seoOg';

// La page est un client component : ce layout serveur porte ses metadata.
export const metadata: Metadata = {
  alternates: { canonical: '/contact' },
  title: 'Nous contacter — TEL & CASH Angers',
  description:
    'Une question sur une commande, un retour ou la garantie ? Contactez l\'équipe TEL & CASH à Angers — réponse sous 24 h ouvrées.',
  ...pageSocial('/contact', 'Nous contacter — TEL & CASH Angers', 'Une question sur une commande, un retour ou la garantie ? Contactez l\'équipe TEL & CASH à Angers — réponse sous 24 h ouvrées.'),
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
