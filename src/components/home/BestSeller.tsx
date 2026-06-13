'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Circle, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/store/useCart';
import {
  buildVariantMatrix,
  pickInitialSelection,
  getOptionAvailability,
  type RawProduct,
  type FrontVariant,
} from '@/lib/productVariants';
import { loadFeaturedProduct } from '@/lib/featuredProduct';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { colorToCss, displayGradeLabelFr, DISPLAY_GRADE_ORDER } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

// Pick the best variant for a (storage, color) pair: prefer in-stock, best grade.
function pickFeaturedVariant(
  variants: FrontVariant[],
  storage: string | null,
  color: string | null,
): FrontVariant | null {
  const matching = variants.filter(v => v.storage === storage && v.color === color);
  if (matching.length === 0) return null;
  const inStock = matching.filter(v => v.stock > 0);
  const pool = inStock.length > 0 ? inStock : matching;
  const rank = (g: string) => {
    const i = DISPLAY_GRADE_ORDER.indexOf(g as (typeof DISPLAY_GRADE_ORDER)[number]);
    return i === -1 ? 99 : i;
  };
  return [...pool].sort((a, b) => rank(a.grade) - rank(b.grade) || a.price - b.price)[0];
}

export function BestSeller() {
  const { addItem, openCart } = useCart();

  const [skus, setSkus] = useState<RawProduct[]>([]);
  const [featured, setFeatured] = useState<{ brand: string; model: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFeaturedProduct().then((fp) => {
      if (cancelled) return;
      if (fp) {
        setSkus(fp.skus);
        setFeatured({ brand: fp.brand, model: fp.model });
        const matrix = buildVariantMatrix(fp.skus);
        const initial = pickInitialSelection(matrix, { storage: null, grade: null, color: null });
        setSelectedStorage(initial.storage);
        setSelectedColor(initial.color);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const matrix = useMemo(() => buildVariantMatrix(skus), [skus]);
  const variant = useMemo(
    () => pickFeaturedVariant(matrix.variants, selectedStorage, selectedColor),
    [matrix, selectedStorage, selectedColor],
  );

  const heroImage = resolveProductImage(
    {
      brand: featured?.brand,
      model: featured?.model,
      images: variant?.representativeImage ? [variant.representativeImage] : [],
    },
    selectedColor,
  );

  const handleAddToCart = async () => {
    if (!variant || variant.stock <= 0) return;
    setAdding(true);
    try {
      await addItem({ id: variant.skuId });
      openCart();
    } finally {
      setAdding(false);
    }
  };

  // Graceful empty state — never crash the homepage.
  if (!loading && (!featured || matrix.variants.length === 0)) {
    return null;
  }

  return (
    <section className="py-16 md:py-20 bg-[#F9F8F5] relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col mb-12 items-center text-center relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#3b82f6] font-caveat text-2xl md:text-3xl -rotate-2 inline-block">
              le plus demandé
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" className="stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-80 animate-pulse" style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}>
              <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
            </svg>
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-black tracking-tight text-[#0A0F1E] mb-3 relative inline-block"
          >
            Le choix de l'excellence.
            <svg viewBox="0 0 280 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-60" style={{ strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px' }}>
              <path d="M 0 6 Q 23 0 46 6 T 92 6 T 138 6 T 184 6 T 230 6 T 280 6" />
            </svg>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-500 max-w-2xl font-medium mt-5"
          >
            Notre modèle le plus plébiscité, reconditionné à la perfection dans nos ateliers.
          </motion.p>
        </div>

        <div className="rounded-[32px] p-6 md:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center relative overflow-visible border border-slate-200/60 shadow-md bg-white">
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-blue-100/40 blur-[100px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />

          {/* Left: product visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative flex justify-center items-center h-full min-h-[420px] lg:min-h-[520px]"
          >
            {loading ? (
              <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
            ) : (
              <motion.img
                key={heroImage}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                src={heroImage}
                alt={featured ? `${featured.brand} ${featured.model}` : 'Produit vedette'}
                onError={onImageErrorToPlaceholder(featured ? `${featured.brand} ${featured.model}` : null)}
                className="w-[90%] max-w-[480px] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)] z-10"
              />
            )}
          </motion.div>

          {/* Right: product details */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-start relative z-10"
          >
            <div className="relative mb-5">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] font-bold text-[11px] tracking-widest uppercase">
                ✦ notre best-seller
              </div>
            </div>

            <h3 className="text-4xl md:text-5xl font-black text-[#0A0F1E] mb-4 tracking-tight relative inline-block">
              {featured ? featured.model : 'Produit vedette'}
              <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-[140px] h-3 fill-none opacity-70" style={{ strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px' }}>
                <path d="M 0 10 Q 12 0 25 10 T 50 10 T 75 10 T 100 10" />
              </svg>
            </h3>

            <p className="text-sm md:text-base text-slate-600 font-medium mb-4 leading-relaxed max-w-md mt-2">
              Reconditionné et testé sur des dizaines de points de contrôle dans nos ateliers. Prêt à vous accompagner partout, en toute confiance.
            </p>

            {variant && (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                État : {displayGradeLabelFr(variant.grade)} (Grade {variant.grade})
              </p>
            )}

            {/* Price — real variant price */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl md:text-4xl font-black text-[#3b82f6]">
                {variant ? `${variant.price.toFixed(0)} €` : '—'}
              </span>
            </div>

            {/* Selectors — wired to the real variant matrix */}
            <div className="flex flex-wrap gap-x-10 gap-y-5 w-full mb-7">
              {matrix.availableColors.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Couleur{selectedColor ? ` · ${colorLabelFr(selectedColor)}` : ''}
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {matrix.availableColors.map((c) => {
                      const avail = getOptionAvailability(matrix, c, 'color', selectedStorage, null, null);
                      const isSel = selectedColor === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(c)}
                          title={`${colorLabelFr(c)}${avail === 'out_of_stock' ? ' — rupture' : ''}`}
                          aria-label={colorLabelFr(c)}
                          className={`w-6 h-6 rounded-full cursor-pointer shadow-sm border transition-all ${isSel ? 'ring-2 ring-offset-2 ring-slate-900' : 'border-slate-200 hover:ring-2 ring-offset-2 ring-slate-300'} ${avail === 'incompatible' ? 'opacity-30' : ''}`}
                          style={{ background: colorToCss(c) }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {matrix.availableStorages.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stockage</span>
                  <div className="flex gap-4">
                    {matrix.availableStorages.map((s) => {
                      const avail = getOptionAvailability(matrix, s, 'storage', null, null, selectedColor);
                      const isSel = selectedStorage === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setSelectedStorage(s)}
                          disabled={avail === 'incompatible'}
                          className={`text-sm pb-0.5 border-b-2 transition-all ${isSel ? 'font-bold text-[#0A0F1E] border-[#0A0F1E]' : 'font-medium text-slate-400 border-transparent hover:text-slate-600'} ${avail === 'incompatible' ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {['5G', 'Écran OLED', 'Charge rapide', 'Double SIM'].map((f) => (
                <div key={f} className="px-3 py-1 bg-white border border-slate-200 text-[#0A0F1E] text-xs font-bold rounded-md shadow-sm">{f}</div>
              ))}
            </div>

            {/* Ce qui est inclus */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 w-full mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Ce qui est inclus</span>
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold"><Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> Chargeur rapide inclus</li>
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold"><Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> Boîte premium</li>
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold"><Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> Garantie 24 mois</li>
              </ul>
            </div>

            {/* Real stock indicator */}
            <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-widest">
              {variant && variant.stock > 0 ? (
                <>
                  <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                  <span className="text-slate-500">
                    En stock — il reste {variant.stock} exemplaire{variant.stock > 1 ? 's' : ''}
                  </span>
                </>
              ) : (
                <>
                  <Circle className="w-2 h-2 fill-rose-500 text-rose-500" />
                  <span className="text-rose-500">Temporairement en rupture</span>
                </>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <Button
                onClick={handleAddToCart}
                disabled={!variant || variant.stock <= 0 || adding}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {adding ? 'Ajout…' : 'Ajouter au panier'}
              </Button>
              {variant && (
                <Link href={`/products/${variant.skuId}`} className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#0A0F1E] rounded-lg text-sm font-semibold px-6 py-2.5 transition-all bg-white">
                    Voir la fiche détaillée
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
