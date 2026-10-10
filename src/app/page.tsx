import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { FeaturesBar } from '@/components/home/FeaturesBar';
import { Categories } from '@/components/home/Categories';
import { BestOffers } from '@/components/home/BestOffers';
import { WhyRefurbished } from '@/components/home/WhyRefurbished';
import { PetitsPrix } from '@/components/home/PetitsPrix';
import { StoreStory } from '@/components/home/StoreStory';
import { Reviews } from '@/components/home/Reviews';
import { FAQ } from '@/components/home/FAQ';
import { faqPageJsonLd } from '@/lib/faq';

// Server component : la page ne fait que composer des sections (clientes pour
// celles qui sont interactives). Refonte v4 (08/10/2026) : ordre et contenu
// calqués sur les maquettes Main.dc.html (mobile) et Accueil-ordi.dc.html.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const metadata: Metadata = {
  alternates: { canonical: `${BASE_URL}/` },
};

// FAQPage : construit depuis src/lib/faq.ts, la même source que <FAQ /> →
// texte identique au caractère près à ce qui est affiché.
const faqLd = faqPageJsonLd();

export default function HomePage() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <Hero />
      {/* Réassurance juste sous le héros, sur ordinateur seulement (maquette).
          Celle du layout se masque alors sur l'accueil en md+ (cf. FeaturesBar). */}
      <FeaturesBar placement="home" className="hidden md:block" />
      <Categories />
      <BestOffers />
      <WhyRefurbished />
      <PetitsPrix />
      <StoreStory />
      <Reviews />
      <FAQ />
    </div>
  );
}
