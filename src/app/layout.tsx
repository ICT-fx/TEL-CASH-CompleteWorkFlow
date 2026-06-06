import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';

export const metadata: Metadata = {
  title: 'TEL & CASH — Smartphones reconditionnés premium',
  description: 'Achetez des smartphones reconditionnés premium de qualité, testés et certifiés en France. Garantie 24 mois. iPhone, Samsung, Xiaomi au meilleur prix.',
};

// Posé AVANT le paint → l'état initial du reveal s'applique dès le 1er rendu
// (zéro flash) ; sans JS la classe n'est pas posée et rien n'est masqué.
const REVEAL_INIT = "try{document.documentElement.classList.add('reveal-js')}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_INIT }} />
        <AuthProvider>
          <PublicLayout>
            {children}
          </PublicLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
