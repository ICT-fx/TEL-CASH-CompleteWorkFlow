// "Souvent achetés ensemble" — fiche produit + prise secteur + câble compatible
// avec le port du téléphone (USB-C ou 2-en-1 Lightning). Le bouton ajoute TOUT
// au panier d'un coup. Masque la section si aucun accessoire pertinent en base.

'use client';

import { useEffect, useState } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { getBundleAccessories } from '@/lib/relatedProducts';
import { formatEur } from '@/lib/price';
import type { RawProduct } from '@/lib/productVariants';

interface Props {
  productSkuId: string;
  productLabel: string;       // "iPhone 15 Pro · 256 Go · Bleu titane"
  productImage: string;
  productPrice: number | null;
  brand?: string | null;      // pour détecter le port de charge du téléphone
  model?: string | null;
}

export function FrequentlyBoughtTogether({
  productSkuId,
  productLabel,
  productImage,
  productPrice,
  brand,
  model,
}: Props) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [accessories, setAccessories] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBundleAccessories(brand, model).then((accs) => {
      if (!cancelled) {
        setAccessories(accs);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [brand, model]);

  // Aucun accessoire pertinent en base → on masque proprement (consigne stricte).
  if (loading) return null;
  if (accessories.length === 0) return null;

  const accPrice = (p: RawProduct) =>
    typeof p.price === 'string' ? parseFloat(p.price) : (p.price as number);
  const accTotal = accessories.reduce((sum, p) => sum + (accPrice(p) || 0), 0);
  const total = (productPrice ?? 0) + accTotal;
  const disabled = productPrice == null;
  const count = accessories.length + 1;

  const cells = [
    {
      key: 'phone',
      image: productImage,
      label: productLabel,
      price: formatEur(productPrice), // null (jamais « 0 € ») si pas de prix
    },
    ...accessories.map((a) => ({
      key: a.id,
      image: a.images?.[0] || '',
      label: a.model || '',
      price: formatEur(a.price, { decimals: 2 }),
    })),
  ];

  const addAll = async () => {
    if (disabled || adding) return;
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
    setAdding(true);
    try {
      await addItem({ id: productSkuId });
      for (const a of accessories) {
        await addItem({ id: a.id });
      }
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-[22px] font-extrabold text-[#0B1437] mb-3.5">Souvent achetés ensemble</h2>

      {/* max-w-[680px] = anti-vide. Mobile : vignettes au-dessus, récap pleine
          largeur en-dessous. Desktop : vignettes à gauche, récap à droite. */}
      <div className="max-w-[680px] border border-[#ECECEC] rounded-[18px] p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-5">
        {/* Vignettes : produit + accessoires reliés par un +.
            Mobile : flex-nowrap + vignettes réduites → les 4 articles tiennent
            sur UNE ligne (~375 px). Desktop : wrap autorisé, tailles d'origine. */}
        <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2.5 flex-nowrap sm:flex-wrap">
          {cells.map((cell, i) => (
            <div key={cell.key} className="flex items-center gap-1 sm:gap-2.5">
              {i > 0 && (
                <span className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#EEF3FF] text-[#2F6BFF] flex items-center justify-center flex-none">
                  <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
                </span>
              )}
              <BundleCell image={cell.image} label={cell.label} price={cell.price} />
            </div>
          ))}
        </div>

        {/* Récap : pleine largeur sur mobile, colonne fixe à droite sur desktop */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto sm:min-w-[200px] shrink-0">
          <span className="text-[10px] uppercase tracking-[0.09em] font-bold text-[#A0A6B0] whitespace-nowrap">
            Total · {count} articles
          </span>
          <span className="text-2xl font-extrabold text-[#0B1437] leading-none whitespace-nowrap">
            {total.toFixed(2)} €
          </span>
          <Button
            onClick={addAll}
            disabled={disabled || adding || done}
            className={`mt-1.5 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap transition-all ${
              disabled ? 'bg-slate-300 text-slate-100 cursor-not-allowed' : 'bg-[#2F6BFF] hover:bg-[#2456d8] text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4 flex-none" />
            {done ? 'Ajoutés ✓' : adding ? 'Ajout…' : 'Tout ajouter au panier'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function BundleCell({ image, label, price }: { image: string; label: string; price: string | null }) {
  return (
    <div className="w-[58px] sm:w-[92px] text-center">
      <div className="w-[46px] h-[46px] sm:w-[84px] sm:h-[84px] bg-[#F6F7F9] rounded-[10px] sm:rounded-[14px] flex items-center justify-center mx-auto mb-1 sm:mb-2 overflow-hidden p-1 sm:p-2">
        <img src={image} alt={label} className="w-full h-full object-contain" />
      </div>
      <p className="text-[9px] sm:text-[11px] text-[#7A8190] mb-0.5 leading-[1.25] sm:leading-[1.3] line-clamp-2">{label}</p>
      {price && <p className="text-[10px] sm:text-[12.5px] font-extrabold text-[#0B1437]">{price}</p>}
    </div>
  );
}
