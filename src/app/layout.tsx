import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';

export const metadata: Metadata = {
  title: 'TEL & CASH — Smartphones reconditionnés premium',
  description: 'Achetez des smartphones reconditionnés premium de qualité, testés et certifiés en France. Garantie 24 mois. iPhone, Samsung, Xiaomi au meilleur prix.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <PublicLayout>
            {children}
          </PublicLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
