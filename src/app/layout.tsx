import type { Metadata } from 'next';
import { Inter, Caveat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import Script from 'next/script';
import { AnalyticsGate } from '@/components/consent/AnalyticsGate';
import { CookieConsent } from '@/components/consent/CookieConsent';
import { Toaster } from '@/components/ui/Toaster';
import { PICKUP_STORE_NAME, PICKUP_STORE_ADDRESS_LINE1, PICKUP_STORE_ADDRESS_LINE2, PICKUP_STORE_PHONE } from '@/lib/shipping';

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

// Store (boutique réelle à Angers, retrait en magasin) — affiché une fois,
// sur tout le site. Type "Store" plutôt qu'"Organization" générique : c'est
// ce qui alimente le pack local / knowledge panel Google (adresse, horaires,
// téléphone), utile pour un commerce avec pignon sur rue. Source unique des
// coordonnées : lib/shipping.ts (mêmes constantes que les emails de retrait).
const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: 'TEL & CASH',
  alternateName: PICKUP_STORE_NAME,
  url: BASE_URL,
  logo: `${BASE_URL}/logo-telcash.png`,
  image: `${BASE_URL}/logo-telcash.png`,
  telephone: `+33 ${PICKUP_STORE_PHONE.replace(/^0/, '')}`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: PICKUP_STORE_ADDRESS_LINE1,
    postalCode: PICKUP_STORE_ADDRESS_LINE2.split(' ')[0],
    addressLocality: 'Angers',
    addressCountry: 'FR',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '10:00',
      closes: '19:00',
    },
  ],
  sameAs: [
    'https://www.instagram.com/angers.telandcash/',
    'https://www.tiktok.com/@telandcash',
  ],
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
        {/* Umami : sans cookies, exempté de consentement → toujours actif. */}
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="c86da298-85af-468e-9451-928fc9cd493a"
          strategy="afterInteractive"
        />
        {/* Vercel Analytics + tracking maison : chargés SEULEMENT après consentement. */}
        <AnalyticsGate />
        <CookieConsent />
        <Toaster />
      </body>
    </html>
  );
}
