import type { Metadata } from 'next';
import { Inter, Caveat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

// Fonts auto-hébergées par next/font : plus d'@import Google Fonts bloquant,
// pas de FOUT inter-domaine, et la police part du même CDN que la page.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-caveat',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'TEL & CASH — Smartphones reconditionnés premium',
    template: '%s',
  },
  description: 'Achetez des smartphones reconditionnés premium de qualité, testés et certifiés en France. Garantie 24 mois. iPhone, Samsung, Xiaomi au meilleur prix.',
  openGraph: {
    title: 'TEL & CASH — Smartphones reconditionnés premium',
    description: 'Smartphones reconditionnés testés et certifiés en France. Garantie 24 mois, retour 30 jours.',
    url: BASE_URL,
    siteName: 'TEL & CASH',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TEL & CASH — Smartphones reconditionnés premium',
    description: 'Smartphones reconditionnés testés et certifiés en France. Garantie 24 mois.',
  },
  // Favicons : auto-détectés par Next via src/app/icon.png (onglet) et
  // src/app/apple-icon.png (apple-touch-icon / écran d'accueil iOS). Le manifest
  // (src/app/manifest.ts) fournit les icônes PWA pour l'ajout à l'écran Android.
};

// Organisation (boutique réelle à Angers) — affiché une fois, sur tout le site.
const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TEL & CASH',
  url: BASE_URL,
  logo: `${BASE_URL}/logo-telcash.png`,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Angers',
    addressCountry: 'FR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${caveat.variable}`}>
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        <AuthProvider>
          <PublicLayout>
            {children}
          </PublicLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
