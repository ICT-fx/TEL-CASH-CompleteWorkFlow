'use client';

// « Moins de 300 € » — rangée défilante, MOBILE uniquement (maquette Main.dc.html).
// Même source de données que « Les plus demandés » (useHomeModels, requête
// mutualisée) : modèles dont le prix « dès » est < 300 €, triés par prix.

import Link from 'next/link';
import { HomeProductCard, ProductCardSkeleton, useHomeModels } from '@/components/home/BestOffers';

const MAX_PRICE = 300;

export function PetitsPrix() {
  const { models, loading } = useHomeModels();
  const cheap = models
    .filter((m) => m.minPrice < MAX_PRICE)
    .sort((a, b) => a.minPrice - b.minPrice)
    .slice(0, 10);

  if (!loading && cheap.length === 0) return null;

  return (
    <section className="md:hidden bg-[#F9F8F5] pt-9 pb-2 flex flex-col gap-3.5" aria-labelledby="petits-prix-title">
      <div className="px-4 flex items-center justify-between">
        <h2 id="petits-prix-title" className="m-0 text-2xl font-black tracking-[-.03em] text-[#0A0F1E]">
          Moins de 300 €
        </h2>
        <Link
          href={`/products?prix_max=${MAX_PRICE}&sort=price-asc`}
          className="inline-flex items-center min-h-[44px] text-sm font-bold text-[#2457E6] hover:text-[#163DAA]"
        >
          Tout voir
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar px-4 pb-5 snap-x snap-mandatory scroll-px-4">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <ProductCardSkeleton key={i} className="flex-none w-[156px]" />)
          : cheap.map((m) => (
              <HomeProductCard key={m.key} m={m} compact className="flex-none w-[156px] snap-start" />
            ))}
        <span className="flex-none w-1.5" aria-hidden="true" />
      </div>
    </section>
  );
}
