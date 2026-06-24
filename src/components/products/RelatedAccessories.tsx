// "Ça s'accorde bien avec" — carrousel d'accessoires (coques, verres,
// chargeurs…). Bouton "+ Ajouter au panier" sur chaque carte. Masque la
// section si aucun accessoire en base.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessories } from '@/lib/relatedProducts';
import { hasValidPrice, formatEur } from '@/lib/price';
import { getProductReviews } from '@/lib/productReviews';
import { Stars } from './Stars';
import type { RawProduct } from '@/lib/productVariants';

export function RelatedAccessories() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [items, setItems] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAccessories().then((data) => {
      if (!cancelled) {
        // Masque les accessoires sans prix valide (câbles « prix à définir » à
        // 0 €) : jamais de « 0 € » dans « Ça s'accorde bien avec ».
        setItems(data.filter(hasValidPrice));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = dir === 'left' ? -el.clientWidth * 0.8 : el.clientWidth * 0.8;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const addAcc = async (acc: RawProduct) => {
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
    await addItem({ id: acc.id });
    setJustAdded(acc.id);
    setTimeout(() => setJustAdded((cur) => (cur === acc.id ? null : cur)), 2000);
  };

  return (
    <section className="mt-12 md:mt-16">
      {/* Panel crème pour différencier visuellement du carrousel iPhones */}
      <div className="bg-[#FAFAFA] border border-[#ECECEC] rounded-3xl p-5 md:p-7">
        <div className="flex items-center gap-3 mb-5">
          {/* Petit picto dessiné « accessoires » (étiquette) */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
            <path d="M4 11.5 11 4.5h7a1.5 1.5 0 0 1 1.5 1.5v7L12.5 20a1.5 1.5 0 0 1-2.1 0l-6.3-6.3a1.5 1.5 0 0 1 0-2.2Z" stroke="#2F6BFF" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="15.5" cy="8.5" r="1.4" fill="#2F6BFF" />
          </svg>
          <h2 className="text-xl md:text-2xl font-black text-[#0B1437]">
            Ça s&apos;accorde bien avec
          </h2>
          <div className="h-0.5 flex-grow bg-[#ECECEC]" />
          <div className="hidden md:flex gap-1.5">
            <button
              onClick={() => scroll('left')}
              aria-label="Précédent"
              className="w-9 h-9 rounded-full border border-[#ECECEC] bg-white text-[#6B7A99] hover:text-[#0B1437] hover:border-slate-300 transition-all flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              aria-label="Suivant"
              className="w-9 h-9 rounded-full border border-[#ECECEC] bg-white text-[#6B7A99] hover:text-[#0B1437] hover:border-slate-300 transition-all flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((acc) => {
            // Tous les items sont déjà filtrés (prix valide) → formatEur ≠ null.
            const priceLabel = formatEur(acc.price, { decimals: 2 });
            // Note démo par accessoire — seed sur sku pour rester stable
            const r = getProductReviews(acc.brand || 'TC', acc.model || '');
            const wasAdded = justAdded === acc.id;
            return (
              <div
                key={acc.id}
                className="snap-start flex-shrink-0 w-[158px] sm:w-[170px] bg-white rounded-2xl border border-[#ECECEC] p-3 hover:shadow-[0_16px_40px_-26px_rgba(20,30,80,0.4)] transition-all flex flex-col"
              >
                <div className="aspect-square rounded-xl bg-[#FAFAFA] border border-[#ECECEC] flex items-center justify-center overflow-hidden mb-2.5">
                  <img
                    src={acc.images?.[0] || ''}
                    alt={acc.model || ''}
                    className="w-full h-full object-contain p-2.5"
                  />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#6B7A99] mb-0.5">
                  {acc.product_type as string}
                </span>
                <h3 className="text-[13px] font-black text-[#0B1437] leading-tight mb-1.5 line-clamp-2">{acc.model}</h3>
                <div className="flex items-center gap-1.5 mb-2.5" title="Note indicative (démo)">
                  <Stars value={r.average} size={11} />
                  <span className="text-[10px] text-[#6B7A99] font-medium">({r.count})</span>
                </div>

                <div className="mt-auto pt-2.5 border-t border-[#ECECEC] flex items-center justify-between gap-2">
                  <span className="text-base font-black text-[#0B1437] tabular-nums">
                    {priceLabel}
                  </span>
                  <Button
                    onClick={() => addAcc(acc)}
                    className={`flex-shrink-0 h-8 px-2.5 rounded-full text-white text-[11px] font-bold transition-all flex items-center gap-1 ${
                      wasAdded ? 'bg-[#16A34A]' : 'bg-[#2F6BFF] hover:bg-[#2456d8] shadow-sm shadow-[#2F6BFF]/25'
                    }`}
                    aria-label="Ajouter au panier"
                  >
                    {wasAdded ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Plus className="w-3.5 h-3.5" strokeWidth={3} />}
                    {wasAdded ? 'Ajouté' : 'Ajouter'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
