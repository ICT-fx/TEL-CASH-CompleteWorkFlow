// "Ça pourrait bien vous intéresser" — carrousel d'autres iPhones (prix proche).
// Données réelles depuis la base via getRelatedIphones(). Note étoiles =
// productReviews.ts (démo, déterministe).

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getRelatedIphones, type RelatedModel } from '@/lib/relatedProducts';
import { productUrl } from '@/lib/productUrl';
import { colorToCss } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';
import { resolveModelCardImage, onImageErrorToPlaceholder } from '@/lib/productImage';
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
        {/* Petit picto dessiné « coup de cœur » — esprit boutique, pas marketplace */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
          <path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.6 12 20 12 20Z" stroke="#2F6BFF" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <h2 className="text-xl md:text-2xl font-black text-[#0B1437]">
          Vous aimerez aussi
        </h2>
        <div className="h-0.5 flex-grow bg-[#ECECEC]" />
        <div className="hidden md:flex gap-1.5">
          <button
            onClick={() => scroll('left')}
            aria-label="Précédent"
            className="w-9 h-9 rounded-full border border-[#ECECEC] bg-white text-[#6B7A99] hover:text-[#0B1437] hover:border-[#cfcfcf] transition-all flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Suivant"
            className="w-9 h-9 rounded-full border border-[#ECECEC] bg-white text-[#6B7A99] hover:text-[#0B1437] hover:border-[#cfcfcf] transition-all flex items-center justify-center"
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
          const image = resolveModelCardImage(
            { brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] },
            m.colorSwatches[0] || null,
          );
          const remainingColors = m.totalColors - m.colorSwatches.length;
          const firstColorFr = m.colorSwatches[0] ? colorLabelFr(m.colorSwatches[0]) : null;
          return (
            <Link
              key={m.slug}
              href={productUrl({ id: m.firstSkuId, model: m.model, storage_capacity: m.firstStorage, grade: m.firstGrade })}
              className="snap-start flex-shrink-0 w-[230px] sm:w-[248px] bg-white rounded-2xl border border-[#ECECEC] p-4 hover:shadow-[0_18px_44px_-26px_rgba(20,30,80,0.35)] hover:-translate-y-1 transition-all flex flex-col group"
            >
              <div className="relative aspect-square rounded-xl bg-[#FAFAFA] border border-[#F0F0F0] flex items-center justify-center overflow-hidden mb-3">
                <img src={image} alt={`${m.brand} ${m.model}`} onError={onImageErrorToPlaceholder(`${m.brand} ${m.model}`)} className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#9AA3B2] mb-1">{m.brand}</span>
              <h3 className="text-sm font-black text-[#0B1437] leading-tight mb-0.5 group-hover:text-[#2F6BFF] transition-colors line-clamp-2">
                {m.model}
              </h3>
              <p className="text-[11px] text-[#9AA3B2] font-medium mb-2">
                À partir de {m.minPrice.toFixed(0)} €{firstColorFr ? ` · ${firstColorFr}` : ''}
              </p>
              <div className="flex items-center gap-1.5 mb-3" title="Note indicative (démo)">
                <Stars value={r.average} size={12} />
                <span className="text-[10px] text-[#9AA3B2] font-medium">({r.count})</span>
              </div>

              <div className="mt-auto flex items-center gap-1">
                {m.colorSwatches.map((c) => (
                  <span
                    key={c}
                    className="w-3 h-3 rounded-full"
                    style={{ background: colorToCss(c), boxShadow: '0 0 0 1px #E2E2E2' }}
                    title={c}
                  />
                ))}
                {remainingColors > 0 && (
                  <span className="text-[10px] font-bold text-[#9AA3B2] ml-1">+{remainingColors}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
