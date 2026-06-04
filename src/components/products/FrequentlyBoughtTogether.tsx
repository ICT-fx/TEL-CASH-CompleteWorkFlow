// "Souvent achetés ensemble" — fiche produit courante + 1 accessoire compagnon.
// Bouton ajoute LES DEUX au panier d'un coup. Masque la section si aucun
// accessoire en base.

'use client';

import { useEffect, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { getBundleAccessory } from '@/lib/relatedProducts';
import type { RawProduct } from '@/lib/productVariants';

interface Props {
  productSkuId: string;
  productLabel: string;       // "iPhone 15 Pro · 256 Go · Bleu titane"
  productImage: string;
  productPrice: number | null;
}

export function FrequentlyBoughtTogether({ productSkuId, productLabel, productImage, productPrice }: Props) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [accessory, setAccessory] = useState<RawProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBundleAccessory().then((acc) => {
      if (!cancelled) {
        setAccessory(acc);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Pas d'accessoire en base → on masque proprement (consigne stricte).
  if (loading) return null;
  if (!accessory) return null;

  const accPrice = typeof accessory.price === 'string' ? parseFloat(accessory.price) : accessory.price;
  const total = (productPrice ?? 0) + (accPrice || 0);
  const disabled = productPrice == null;

  const addBoth = async () => {
    if (disabled || adding) return;
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
    setAdding(true);
    try {
      await addItem({ id: productSkuId });
      await addItem({ id: accessory.id });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-xl md:text-2xl font-black text-[#0A0F1E] mb-5 flex items-center gap-3">
        Souvent achetés ensemble
        <div className="h-0.5 flex-grow bg-slate-100" />
      </h2>

      <div className="bg-white rounded-2xl border border-slate-100 p-5 md:p-6">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-stretch lg:items-center">
          {/* Phone + accessoire avec un "+" entre les deux */}
          <div className="flex items-center gap-3 sm:gap-5 flex-grow min-w-0">
            <div className="flex flex-col items-center gap-2 flex-shrink-0 w-24 sm:w-28">
              <div className="w-full aspect-square rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                <img src={productImage} alt={productLabel} className="w-full h-full object-contain p-2" />
              </div>
              <span className="text-[11px] text-slate-500 font-bold text-center line-clamp-2 leading-tight">{productLabel}</span>
              {productPrice != null && (
                <span className="text-xs font-black text-[#0A0F1E] tabular-nums">{productPrice.toFixed(0)} €</span>
              )}
            </div>

            <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 flex-shrink-0" strokeWidth={3} />

            <div className="flex flex-col items-center gap-2 flex-shrink-0 w-24 sm:w-28">
              <div className="w-full aspect-square rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                <img src={accessory.images?.[0] || ''} alt={accessory.model || ''} className="w-full h-full object-contain p-2" />
              </div>
              <span className="text-[11px] text-slate-500 font-bold text-center line-clamp-2 leading-tight">{accessory.model}</span>
              {accPrice != null && (
                <span className="text-xs font-black text-[#0A0F1E] tabular-nums">{accPrice.toFixed(2)} €</span>
              )}
            </div>
          </div>

          {/* Total + CTA */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-stretch gap-3 lg:gap-2 lg:ml-auto flex-shrink-0 lg:w-56">
            <div className="flex-grow text-center sm:text-left lg:text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total panier</p>
              <p className="text-2xl font-black text-[#0A0F1E] tabular-nums leading-none">{total.toFixed(2)} €</p>
            </div>
            <Button
              onClick={addBoth}
              disabled={disabled || adding || done}
              className={`px-5 py-3 rounded-lg text-sm font-bold whitespace-nowrap flex items-center justify-center gap-2 transition-all ${
                disabled ? 'bg-slate-300 text-slate-100 cursor-not-allowed' : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {done ? 'Ajoutés ✓' : adding ? 'Ajout…' : 'Tout ajouter au panier'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
