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
      <h2 className="text-[22px] font-extrabold text-[#0B1437] mb-3.5">Souvent achetés ensemble</h2>

      {/* max-w-[640px] = clé anti-vide : la carte ne s'étire pas pleine largeur */}
      <div className="max-w-[640px] border border-[#ECECEC] rounded-[18px] p-[18px_22px] flex items-center justify-between gap-5 flex-wrap">
        {/* Vignettes agrandies : produit + accessoire reliés par un + */}
        <div className="flex items-center gap-3.5">
          <BundleCell image={productImage} label={productLabel} price={productPrice != null ? `${productPrice.toFixed(0)} €` : null} />
          <span className="w-7 h-7 rounded-full bg-[#EEF3FF] text-[#2F6BFF] flex items-center justify-center flex-none">
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
          <BundleCell image={accessory.images?.[0] || ''} label={accessory.model || ''} price={accPrice != null ? `${accPrice.toFixed(2)} €` : null} />
        </div>

        {/* Récap compact à droite, bouton taille normale */}
        <div className="flex flex-col items-stretch sm:items-end gap-1.5 min-w-0 sm:min-w-[188px] flex-1 sm:flex-none">
          <span className="text-[10px] uppercase tracking-[0.09em] font-bold text-[#A0A6B0]">Total · 2 articles</span>
          <span className="text-[23px] font-extrabold text-[#0B1437] leading-none self-start sm:self-auto">{total.toFixed(2)} €</span>
          <Button
            onClick={addBoth}
            disabled={disabled || adding || done}
            className={`mt-1.5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
              disabled ? 'bg-slate-300 text-slate-100 cursor-not-allowed' : 'bg-[#2F6BFF] hover:bg-[#2456d8] text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            {done ? 'Ajoutés ✓' : adding ? 'Ajout…' : 'Tout ajouter au panier'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function BundleCell({ image, label, price }: { image: string; label: string; price: string | null }) {
  return (
    <div className="w-[118px] text-center">
      <div className="w-[102px] h-[102px] bg-[#F6F7F9] rounded-[14px] flex items-center justify-center mx-auto mb-2 overflow-hidden p-2.5">
        <img src={image} alt={label} className="w-full h-full object-contain" />
      </div>
      <p className="text-[11.5px] text-[#7A8190] mb-0.5 leading-[1.3] line-clamp-2">{label}</p>
      {price && <p className="text-[13.5px] font-extrabold text-[#0B1437]">{price}</p>}
    </div>
  );
}
