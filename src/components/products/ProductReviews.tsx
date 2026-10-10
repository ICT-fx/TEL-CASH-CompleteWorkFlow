// « Avis Google du magasin » sur la fiche produit (refonte v4). Ce sont les
// VRAIS avis Google du magasin d'Angers (cf. realReviews.ts) — présentés comme
// tels, jamais comme des avis sur le produit. Pas d'aggregateRating en JSON-LD.

'use client';

import { getProductReviews } from '@/lib/productReviews';

interface Props {
  brand: string;
  model: string;
}

// Fiche Google du magasin (même URL que l'accueil / le JSON-LD Organization).
const GOOGLE_PLACE_URL =
  'https://www.google.com/maps/place/Tel+and+Cash+Angers/@47.4734511,-0.5521127,17z/data=!3m1!4b1!4m6!3m5!1s0x480879224532671b:0x482a7e7aeb686dcb!8m2!3d47.4734475!4d-0.5495324!16s%2Fg%2F11y6p17ml6';

const fr1 = (n: number) => n.toFixed(1).replace('.', ',');

export function ProductReviews({ brand, model }: Props) {
  const bundle = getProductReviews(brand, model);

  return (
    <section aria-labelledby="avis-titre" className="flex flex-col gap-3 md:gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="avis-titre" className="text-[22px] md:text-[28px] font-extrabold tracking-[-0.02em] text-[#0A0F1E]">
            Avis Google du magasin
          </h2>
          <span className="text-[14px] font-semibold text-[#47506A]">
            {fr1(bundle.average)} sur 5 · {bundle.count} avis
          </span>
        </div>
        <a
          href={GOOGLE_PLACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center min-h-[44px] text-[15px] font-bold text-[#2457E6] hover:text-[#163DAA]"
        >
          Voir sur Google
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {bundle.reviews.map((r, i) => (
          <figure
            key={i}
            className={`m-0 bg-white border border-[#E7E9EF] rounded-2xl p-4 md:p-5 flex flex-col gap-2.5 ${i > 0 ? 'hidden md:flex' : ''}`}
          >
            <blockquote className="m-0 text-[15px] leading-relaxed text-[#0A0F1E]">« {r.body} »</blockquote>
            <figcaption className="mt-auto text-[14px] font-bold text-[#47506A]">{r.author} · avis Google</figcaption>
          </figure>
        ))}
      </div>

      <a
        href={GOOGLE_PLACE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="md:hidden inline-flex items-center min-h-[44px] text-[14px] font-bold text-[#2457E6]"
      >
        Lire les {bundle.count} avis sur Google
      </a>
    </section>
  );
}
