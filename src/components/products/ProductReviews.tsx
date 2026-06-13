// Section "Avis clients" sur la fiche produit — adossée aux VRAIS avis Google
// de la boutique (cf. realReviews.ts). Pas de badge « exemple » : ils sont réels.

'use client';

import { getProductReviews } from '@/lib/productReviews';
import { reviewInitials, reviewAvatarColor } from '@/lib/realReviews';
import { Stars } from './Stars';

interface Props {
  brand: string;
  model: string;
}

export function ProductReviews({ brand, model }: Props) {
  const bundle = getProductReviews(brand, model);
  const total  = bundle.count || 1;

  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-xl md:text-2xl font-black text-[#0A0F1E] mb-5 flex items-center gap-3">
        Avis clients
        <div className="h-0.5 flex-grow bg-slate-100" />
      </h2>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-7">
        {/* Résumé */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10 mb-7 pb-7 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="text-5xl md:text-6xl font-black text-[#0A0F1E] leading-none">
              {bundle.average.toFixed(1)}
            </div>
            <div>
              <Stars value={bundle.average} size={18} />
              <p className="text-xs text-slate-500 mt-1.5 font-medium">{bundle.count} avis</p>
            </div>
          </div>

          {/* Distribution 5★…1★ */}
          <ul className="flex-grow space-y-1.5 max-w-md w-full">
            {bundle.distribution.map((n, i) => {
              const stars = 5 - i;
              const pct = total > 0 ? (n / total) * 100 : 0;
              return (
                <li key={stars} className="flex items-center gap-3 text-xs">
                  <span className="w-6 font-bold text-slate-600">{stars}★</span>
                  <span className="flex-grow h-2 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full bg-yellow-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-bold text-slate-500 tabular-nums">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Cartes d'avis */}
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bundle.reviews.map((r, i) => (
            <li
              key={i}
              className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-2">
                <Stars value={r.rating} size={14} />
              </div>
              <p className="text-xs text-slate-600 leading-relaxed flex-grow">"{r.body}"</p>
              <div className="flex items-center gap-2 mt-4 text-[11px] font-semibold text-slate-600">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                  style={{ background: reviewAvatarColor(r.author) }}
                  aria-hidden="true"
                >
                  {reviewInitials(r.author)}
                </span>
                <span>{r.author}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
