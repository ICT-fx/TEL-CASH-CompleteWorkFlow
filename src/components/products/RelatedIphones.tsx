// "Ça pourrait bien vous intéresser" — carrousel d'autres iPhones (prix proche).
// Données réelles depuis la base via getRelatedIphones(). Note étoiles =
// productReviews.ts (démo, déterministe).

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getRelatedIphones, type RelatedModel } from '@/lib/relatedProducts';
import { colorToCss } from '@/lib/products';
import { resolveProductImage } from '@/lib/productImage';
import { getProductReviews } from '@/lib/productReviews';
import { Stars } from './Stars';

interface Props {
  brand: string;
  model: string;
  price: number;
}

export function RelatedIphones({ brand, model, price }: Props) {
  const [items, setItems] = useState<RelatedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getRelatedIphones(brand, model, price, 6).then((data) => {
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [brand, model, price]);

  if (loading) return null;
  if (items.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = dir === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <section className="mt-12 md:mt-16">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl md:text-2xl font-black text-[#0A0F1E]">
          Ça pourrait bien vous intéresser
        </h2>
        <div className="h-0.5 flex-grow bg-slate-100" />
        <div className="hidden md:flex gap-1.5">
          <button
            onClick={() => scroll('left')}
            aria-label="Précédent"
            className="w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#0A0F1E] hover:border-slate-300 transition-all flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Suivant"
            className="w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#0A0F1E] hover:border-slate-300 transition-all flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((m) => {
          const r = getProductReviews(m.brand, m.model);
          const image = resolveProductImage(
            { brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] },
            m.colorSwatches[0] || null,
          );
          const compareAt = Math.round(m.minPrice * 1.3);
          const remainingColors = m.totalColors - m.colorSwatches.length;
          return (
            <Link
              key={m.slug}
              href={`/products/${m.firstSkuId}`}
              className="snap-start flex-shrink-0 w-[220px] sm:w-[240px] bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-lg hover:border-slate-200 transition-all flex flex-col group"
            >
              <div className="aspect-square rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden mb-3 group-hover:bg-blue-50/40 transition-colors">
                <img src={image} alt={`${m.brand} ${m.model}`} className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{m.brand}</span>
              <h3 className="text-sm font-black text-[#0A0F1E] leading-tight mb-1.5 group-hover:text-[#3b82f6] transition-colors line-clamp-2">
                {m.model}
              </h3>
              <div className="flex items-center gap-1.5 mb-3">
                <Stars value={r.average} size={12} />
                <span className="text-[10px] text-slate-400 font-medium">({r.count})</span>
              </div>

              <div className="flex items-center gap-1 mb-3">
                {m.colorSwatches.map((c) => (
                  <span
                    key={c}
                    className="w-3 h-3 rounded-full border border-slate-200"
                    style={{ background: colorToCss(c) }}
                    title={c}
                  />
                ))}
                {remainingColors > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 ml-1">+{remainingColors}</span>
                )}
              </div>

              <div className="mt-auto pt-3 border-t border-slate-50">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold leading-none mb-1">À partir de</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-[#0A0F1E] tabular-nums">{m.minPrice.toFixed(0)} €</span>
                  <span className="text-xs text-slate-400 font-bold line-through tabular-nums">{compareAt} €</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
