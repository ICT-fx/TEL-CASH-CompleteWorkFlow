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
        setItems(data);
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
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl md:text-2xl font-black text-[#0A0F1E]">
          Ça s'accorde bien avec
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
        {items.map((acc) => {
          const price = typeof acc.price === 'string' ? parseFloat(acc.price) : acc.price;
          // Note démo par accessoire — seed sur sku pour rester stable
          const r = getProductReviews(acc.brand || 'TC', acc.model || '');
          const wasAdded = justAdded === acc.id;
          return (
            <div
              key={acc.id}
              className="snap-start flex-shrink-0 w-[220px] sm:w-[240px] bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-lg hover:border-slate-200 transition-all flex flex-col"
            >
              <div className="aspect-square rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden mb-3">
                <img
                  src={acc.images?.[0] || ''}
                  alt={acc.model || ''}
                  className="w-full h-full object-contain p-3"
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                {acc.product_type as string}
              </span>
              <h3 className="text-sm font-black text-[#0A0F1E] leading-tight mb-1.5 line-clamp-2">{acc.model}</h3>
              <div className="flex items-center gap-1.5 mb-3">
                <Stars value={r.average} size={12} />
                <span className="text-[10px] text-slate-400 font-medium">({r.count})</span>
              </div>

              <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                <span className="text-lg font-black text-[#0A0F1E] tabular-nums">
                  {(price || 0).toFixed(2)} €
                </span>
                <Button
                  onClick={() => addAcc(acc)}
                  className={`flex-shrink-0 w-9 h-9 p-0 rounded-full text-white transition-all flex items-center justify-center ${
                    wasAdded ? 'bg-emerald-500' : 'bg-[#2563EB] hover:bg-blue-700 shadow-md shadow-blue-500/20'
                  }`}
                  aria-label="Ajouter au panier"
                >
                  {wasAdded ? <Check className="w-4 h-4" strokeWidth={3} /> : <Plus className="w-4 h-4" strokeWidth={3} />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
