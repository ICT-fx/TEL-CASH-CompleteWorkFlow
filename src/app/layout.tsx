import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FeaturesBar } from '@/components/home/FeaturesBar';
import { MiniCart } from '@/components/cart/MiniCart';

export const metadata: Metadata = {
  title: 'TEL & CASH — Smartphones reconditionnés premium',
  description: 'Achetez des smartphones reconditionnés premium de qualité, testés et certifiés en France. Garantie 24 mois. iPhone, Samsung, Xiaomi au meilleur prix.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">{children}</main>
            <FeaturesBar />
            <Footer />
            <MiniCart />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
