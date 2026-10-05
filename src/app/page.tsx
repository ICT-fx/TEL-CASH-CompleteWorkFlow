import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { Categories } from '@/components/home/Categories';
import { BestOffers } from '@/components/home/BestOffers';
import { BestSeller } from '@/components/home/BestSeller';
import { Grades } from '@/components/home/Grades';
import { HowItWorks } from '@/components/home/HowItWorks';
import { StoreStory } from '@/components/home/StoreStory';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { Reviews } from '@/components/home/Reviews';
import { Warranty } from '@/components/home/Warranty';
import { WhyRefurbished } from '@/components/home/WhyRefurbished';
import { FAQ } from '@/components/home/FAQ';

// Server component : la page ne fait que composer des sections (clientes pour
// celles qui sont interactives). Le fondu d'entrée global (motion.div) a été
// retiré : il forçait toute la home en client et retardait le premier rendu —
// l'apparition au scroll (Reveal) assure déjà la mise en scène.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://telandcash.fr';

export const metadata: Metadata = {
  alternates: { canonical: `${BASE_URL}/` },
};

// FAQPage : reprend 4 des 5 questions visibles dans <FAQ /> (mêmes textes —
// à garder synchronisés avec components/home/FAQ.tsx). La question sur le
// paiement en plusieurs fois (Klarna) n'est volontairement pas reprise.
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      q: 'La batterie est-elle neuve ?',
      a: "Les batteries sont testées et doivent présenter une capacité supérieure à 85% de leur charge initiale. Si ce n'est pas le cas, elles sont remplacées par des batteries neuves certifiées avant la mise en vente.",
    },
    {
      q: 'Comment fonctionne la garantie de 24 mois ?',
      a: 'La garantie couvre tous les dysfonctionnements logiciels et matériels indépendants de votre usage (hors casse, oxydation, ou ouverture par un tiers). Le retour et la réparation sont pris en charge par nos services.',
    },
    {
      q: "Puis-je retourner le produit s'il ne me convient pas ?",
      a: "Oui, vous disposez d'un délai de rétractation de 30 jours pour nous renvoyer l'appareil (à condition qu'il soit dans le même état) et obtenir un remboursement intégral.",
    },
    {
      q: 'Comment choisir le grade esthétique ?',
      a: "Le Grade A correspond à un état comme neuf (aucune rayure). Le Grade B présente de légères micro-rayures invisibles écran allumé. Le Grade C montre des traces d'usure plus prononcées. Dans tous les cas, l'appareil est 100% fonctionnel.",
    },
  ].map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function HomePage() {
  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Hero />
      <Marquee />
      {/* 1. Ticker → dark navy #0A0F1E */}
      <Categories />
      {/* 2. La référence du reconditionné premium → off-white chaud #F9F8F5 */}
      <WhyChooseUs />
      {/* 3. -40% smartphones → dark navy #0A0F1E */}
      <BestOffers />
      {/* 4. Recommandés pour vous → off-white chaud #F9F8F5 */}
      <BestSeller />
      {/* 5. Le choix de l'excellence → off-white chaud #F9F8F5 */}
      <WhyRefurbished />
      {/* 6. Un smartphone reconditionné c'est quoi ? → off-white chaud #F9F8F5 */}
      <Warranty />
      {/* 7. Garantie & SAV 100% Français → blanc pur #FFFFFF */}
      <Grades />
      {/* 8. Nos grades de qualité → off-white chaud #F9F8F5 */}
      <HowItWorks />
      {/* 9. Comment ça marche ? → dark navy #0A0F1E */}
      <Reviews />
      {/* 10. Ils nous font confiance → blanc pur #FFFFFF */}
      <StoreStory />
      {/* 11. Pas un entrepôt / boutique → off-white chaud #F9F8F5 */}
      <FAQ />
      {/* 12. Newsletter + FAQ → blanc pur #FFFFFF */}
    </div>
  );
}
