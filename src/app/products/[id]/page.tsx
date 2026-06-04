'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildVariantMatrix,
  getOptionAvailability,
  pickInitialSelection,
  pickSkuForSelection,
  reconcileSelection,
  type OptionAvailability,
  type RawProduct,
  type VariantAxis,
} from '@/lib/productVariants';
import { colorToCss, gradeLabelFr, normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage } from '@/lib/productImage';
import { getProductReviews } from '@/lib/productReviews';
import { getIphoneSpecs } from '@/lib/iphoneSpecs';
import { StickyBuyBar } from '@/components/products/StickyBuyBar';
import { ReassuranceBand } from '@/components/products/ReassuranceBand';
import { TechSpecs } from '@/components/products/TechSpecs';
import { GradeExplainer } from '@/components/products/GradeExplainer';
import { ProductReviews } from '@/components/products/ProductReviews';
import { FrequentlyBoughtTogether } from '@/components/products/FrequentlyBoughtTogether';
import { RelatedIphones } from '@/components/products/RelatedIphones';
import { RelatedAccessories } from '@/components/products/RelatedAccessories';
import { Stars } from '@/components/products/Stars';

// Phase-1 reskin (hero) + Phase-2 sections d'enrichissement. La hero reprend
// le design de BestSeller.tsx. Toute la logique variantes / panier vient
// toujours de productVariants.ts.

// Mini-libellés affichés sous chaque bouton Grade dans le sélecteur.
const GRADE_MINI_LABEL: Record<'A' | 'B' | 'C', string> = {
  A: 'Comme neuf',
  B: 'Très bon',
  C: 'Correct',
};


export default function ProductDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [initialSku, setInitialSku] = useState<RawProduct | null>(null);
  const [siblings, setSiblings] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  // User selection
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // 1. Fetch the SKU pointed at by the URL, then 2. fetch its siblings
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/products/${params.id}`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const sku: RawProduct = await res.json();
        if (cancelled) return;
        setInitialSku(sku);

        // Fetch siblings first, then pick a stock-aware initial selection so
        // the customer doesn't land on an out-of-stock combination silently.
        const skuList: RawProduct[] = await (async () => {
          if (!sku.brand || !sku.model) return [sku];
          const url = `/api/products?brand=${encodeURIComponent(sku.brand)}&model=${encodeURIComponent(sku.model)}&limit=all`;
          try {
            const sibRes = await fetch(url);
            if (!sibRes.ok) return [sku];
            const data = await sibRes.json();
            return (data.products as RawProduct[]) || [sku];
          } catch {
            return [sku];
          }
        })();

        if (cancelled) return;
        setSiblings(skuList);

        const matrix = buildVariantMatrix(skuList);
        const initial = pickInitialSelection(matrix, {
          storage: (sku.storage_capacity || '').trim() || null,
          grade: normalizeGradeLetter(sku.grade) || (sku.grade || '').trim() || null,
          color: (sku.color || '').trim() || null,
        });
        setSelectedStorage(initial.storage);
        setSelectedGrade(initial.grade);
        setSelectedColor(initial.color);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (params.id) run();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const matrix = useMemo(() => buildVariantMatrix(siblings), [siblings]);

  const currentPick = useMemo(
    () => pickSkuForSelection(matrix, selectedStorage, selectedGrade, selectedColor),
    [matrix, selectedStorage, selectedGrade, selectedColor]
  );

  const handleOptionClick = (axis: VariantAxis, value: string) => {
    const current = { storage: selectedStorage, grade: selectedGrade, color: selectedColor };
    const avail = getOptionAvailability(matrix, value, axis, current.storage, current.grade, current.color);

    // 'available' → keep the other axes untouched, just apply the new value.
    // 'out_of_stock' OR 'incompatible' → run reconcile to find an in-stock
    // combination (or, failing that, surface the rupture clearly).
    if (avail === 'available') {
      if (axis === 'storage') setSelectedStorage(value);
      if (axis === 'grade') setSelectedGrade(value);
      if (axis === 'color') setSelectedColor(value);
      return;
    }

    const next = reconcileSelection(matrix, axis, value, current);
    if (next) {
      setSelectedStorage(next.storage);
      setSelectedGrade(next.grade);
      setSelectedColor(next.color);
    }
  };

  const handleAddToCart = async () => {
    if (!currentPick) return;
    if (!user) {
      window.location.href = '/auth/login';
      return;
    }
    // Find the raw SKU in our siblings list — useCart.addItem expects a product-like object
    const sku = siblings.find((s) => s.id === currentPick.skuId);
    if (!sku) return;
    await addItem(sku as any);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !initialSku) {
    return (
      <div className="min-h-screen bg-[#F9F8F5] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h2 className="text-3xl font-black text-[#0A0F1E] mb-4">Oups !</h2>
          <p className="text-slate-500 mb-8">Ce produit semble avoir disparu de notre catalogue ou n&apos;existe pas encore.</p>
          <Link href="/products">
            <Button className="bg-[#0A0F1E] text-white px-8 py-4 rounded-xl font-bold">Retour au catalogue</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = `${initialSku.brand} ${initialSku.model}`;
  const currentPrice = currentPick?.price ?? null;
  const originalPrice = currentPrice ? currentPrice * 1.3 : null;
  const savings = currentPrice && originalPrice ? Math.round(originalPrice - currentPrice) : 0;
  const currentStock = currentPick?.stock ?? 0;
  const stockLabel =
    currentStock === 0
      ? 'Rupture sur cette combinaison'
      : currentStock <= 3
        ? `Plus que ${currentStock} disponible${currentStock > 1 ? 's' : ''}`
        : 'En stock';
  const stockColor = currentStock === 0 ? 'text-rose-600' : currentStock <= 3 ? 'text-amber-600' : 'text-emerald-600';

  const cartDisabled = !currentPick || currentStock === 0;

  // Visual availability cue : clickable in every state — clicking on
  // out_of_stock / incompatible triggers reconcile() inside handleOptionClick.
  const availTitle = (avail: OptionAvailability, label: string): string | undefined => {
    if (avail === 'available') return label;
    if (avail === 'out_of_stock') return `${label} — rupture (cliquer pour ajuster)`;
    return `${label} — combinaison indisponible (cliquer pour ajuster)`;
  };

  // Hero image driven by the SELECTED color (cf. BestSeller). Falls back to
  // the matrix variant image, then to whatever resolveProductImage decides.
  const heroImage =
    currentPick?.image ||
    resolveProductImage(
      { brand: initialSku.brand, model: initialSku.model, images: initialSku.images || [] },
      selectedColor,
    );

  const selectedGradeLetter = normalizeGradeLetter(selectedGrade);

  // Reviews — déterministes par modèle (cf. productReviews.ts, démo).
  const reviewBundle = getProductReviews(initialSku.brand || 'Apple', initialSku.model || '');

  // Battery health derived from the selected grade (catalogue convention :
  // A=100, B=92, C=85 — cf. scripts/make-seed-catalogue.js).
  const batteryForGrade = selectedGradeLetter === 'A' ? 100
    : selectedGradeLetter === 'B' ? 92
    : selectedGradeLetter === 'C' ? 85
    : null;

  // Feature tags — tirés de iphoneSpecs si on a la fiche, sinon un set
  // générique. Garantit qu'on ne ment pas sur les capacités du modèle.
  const featureTags = (() => {
    const spec = getIphoneSpecs(initialSku.model);
    if (!spec) return ['Reconditionné', 'Testé', 'Garanti 24 mois'];
    const tags: string[] = [];
    tags.push(spec.reseau);
    if (/OLED|XDR/i.test(spec.ecran)) tags.push('Écran OLED');
    else tags.push('Écran Retina');
    if (/USB-C/i.test(spec.connectique)) tags.push('USB-C');
    else tags.push('Lightning');
    if (/MagSafe|magsafe/i.test(spec.connectique) || spec.annee >= 2020) tags.push('Charge rapide');
    if (/Face ID/i.test(spec.selfie)) tags.push('Face ID');
    else if (/Touch ID/i.test(spec.selfie)) tags.push('Touch ID');
    return tags.slice(0, 5);
  })();

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
      {/* Top bar (non-sticky : remplacée au scroll par StickyBuyBar) */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="container mx-auto px-4 max-w-7xl h-14 flex items-center justify-between">
          <Link href="/products" className="flex items-center gap-2 text-sm font-bold text-[#0A0F1E] hover:text-blue-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Retour à la boutique
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Garantie 24 mois incluse</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Livraison offerte</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-10 md:py-16">

        {/* Hero card — same look as BestSeller "Le choix de l'excellence" */}
        <div className="rounded-[32px] p-6 md:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center relative overflow-visible border border-slate-200/60 shadow-md bg-white">
          {/* Soft blue blur behind the phone — same as BestSeller */}
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-blue-100/40 blur-[100px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />

          {/* LEFT — product visual driven by selected color */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative flex justify-center items-center h-full min-h-[320px] lg:min-h-[460px]"
          >
            <motion.img
              key={heroImage}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              src={heroImage}
              alt={displayName}
              className="w-[75%] max-w-[360px] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)] z-10"
            />
          </motion.div>

          {/* RIGHT — details + selectors */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col items-start relative z-10"
          >
            {/* Badge — same pill style as BestSeller */}
            <div className="relative mb-5">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] font-bold text-[11px] tracking-widest uppercase">
                ✦ reconditionné premium
              </div>
            </div>

            {/* Title with wavy underline — same SVG flourish */}
            <h1 className="text-4xl md:text-5xl font-black text-[#0A0F1E] mb-3 tracking-tight relative inline-block">
              {displayName}
              <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-[140px] h-3 fill-none opacity-70" style={{ strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px' }}>
                <path d="M 0 10 Q 12 0 25 10 T 50 10 T 75 10 T 100 10" />
              </svg>
            </h1>

            <a
              href="#avis"
              className="inline-flex items-center gap-2 mb-4 text-sm font-bold text-slate-600 hover:text-[#0A0F1E] transition-colors"
            >
              <Stars value={reviewBundle.average} size={14} />
              <span className="tabular-nums">{reviewBundle.average.toFixed(1)}/5</span>
              <span className="text-slate-400 font-medium">· {reviewBundle.count} avis</span>
            </a>

            <p className="text-sm md:text-base text-slate-600 font-medium mb-4 leading-relaxed max-w-md mt-2">
              Reconditionné et testé sur des dizaines de points de contrôle dans nos ateliers. Prêt à vous accompagner partout, en toute confiance.
            </p>

            {/* État ligne — suit le grade sélectionné */}
            {selectedGrade && (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                État : {gradeLabelFr(selectedGrade)} {selectedGradeLetter && `(Grade ${selectedGradeLetter})`}
              </p>
            )}

            {/* Price block */}
            <div className="flex items-baseline gap-4 flex-wrap mb-7">
              {currentPrice != null ? (
                <>
                  <span className="text-4xl md:text-5xl font-black text-[#3b82f6] tracking-tight">
                    {currentPrice.toFixed(0)} €
                  </span>
                  {originalPrice && (
                    <span className="text-sm text-slate-400 font-bold line-through">
                      {originalPrice.toFixed(0)} € neuf
                    </span>
                  )}
                  {savings > 0 && (
                    <span className="text-xs font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                      Économisez {savings} €
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg font-bold text-slate-500">Sélectionnez une option valide</span>
              )}
            </div>

            {/* Color selector — round swatches (BestSeller style) */}
            {matrix.availableColors.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Couleur{selectedColor ? ` · ${colorLabelFr(selectedColor)}` : ''}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {matrix.availableColors.map((c) => {
                    const avail = getOptionAvailability(matrix, c, 'color', selectedStorage, selectedGrade, null);
                    const isSel = selectedColor === c;
                    return (
                      <button
                        key={c}
                        onClick={() => handleOptionClick('color', c)}
                        title={availTitle(avail, colorLabelFr(c))}
                        aria-label={colorLabelFr(c)}
                        className={`w-7 h-7 rounded-full cursor-pointer shadow-sm border transition-all ${isSel ? 'ring-2 ring-offset-2 ring-[#0A0F1E]' : 'border-slate-200 hover:ring-2 ring-offset-2 ring-slate-300'} ${avail === 'incompatible' ? 'opacity-30' : avail === 'out_of_stock' ? 'opacity-60' : ''}`}
                        style={{ background: colorToCss(c) }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Storage selector — bottom-border tabs (BestSeller style) */}
            {matrix.availableStorages.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stockage</span>
                <div className="flex gap-5 flex-wrap">
                  {matrix.availableStorages.map((s) => {
                    const avail = getOptionAvailability(matrix, s, 'storage', null, selectedGrade, selectedColor);
                    const isSel = selectedStorage === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleOptionClick('storage', s)}
                        title={availTitle(avail, s)}
                        className={`text-sm pb-0.5 border-b-2 transition-all ${isSel ? 'font-bold text-[#0A0F1E] border-[#0A0F1E]' : 'font-medium text-slate-400 border-transparent hover:text-slate-600'} ${avail === 'incompatible' ? 'opacity-30' : avail === 'out_of_stock' ? 'opacity-60' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grade selector — NEW (absent de BestSeller). 3 cartes A/B/C
                avec mini-libellé sous chaque lettre. Le prix et l'état se
                mettent à jour via la sélection (logique reconcile existante). */}
            {matrix.availableGrades.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-6 w-full">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">État du téléphone</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {matrix.availableGrades.map((g) => {
                    const letter = normalizeGradeLetter(g) || g;
                    const mini = (GRADE_MINI_LABEL as Record<string, string>)[letter] ?? gradeLabelFr(g);
                    const avail = getOptionAvailability(matrix, g, 'grade', selectedStorage, null, selectedColor);
                    const isSel = selectedGrade === g;
                    return (
                      <button
                        key={g}
                        onClick={() => handleOptionClick('grade', g)}
                        title={availTitle(avail, gradeLabelFr(g))}
                        className={`flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border-2 transition-all ${isSel ? 'border-[#3b82f6] bg-[#3b82f6]/5' : 'border-slate-200 hover:border-slate-300 bg-white'} ${avail === 'incompatible' ? 'opacity-30' : avail === 'out_of_stock' ? 'opacity-60' : ''}`}
                      >
                        <span className={`text-lg font-black ${isSel ? 'text-[#3b82f6]' : 'text-[#0A0F1E]'}`}>
                          Grade {letter}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">{mini}</span>
                        {avail === 'out_of_stock' && (
                          <span className="text-[9px] font-bold text-rose-500 mt-0.5 uppercase tracking-wider">rupture</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feature tags — alimentés par iphoneSpecs.ts (cf. featureTags ci-dessus) */}
            <div className="flex flex-wrap gap-2 mb-6">
              {featureTags.map((f) => (
                <div key={f} className="px-3 py-1 bg-white border border-slate-200 text-[#0A0F1E] text-xs font-bold rounded-md shadow-sm">
                  {f}
                </div>
              ))}
            </div>

            {/* Ce qui est inclus — même structure que BestSeller */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 w-full mb-7">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Ce qui est inclus</span>
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                  Chargeur rapide inclus
                </li>
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                  Boîte Tel &amp; Cash premium
                </li>
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                  Garantie 24 mois
                </li>
              </ul>
            </div>

            {/* Stock — même dot Circle vert/rouge que BestSeller */}
            <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-widest">
              {currentStock > 0 ? (
                <>
                  <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                  <span className={stockColor}>
                    En stock — il reste {currentStock} exemplaire{currentStock > 1 ? 's' : ''}
                  </span>
                </>
              ) : (
                <>
                  <Circle className="w-2 h-2 fill-rose-500 text-rose-500" />
                  <span className="text-rose-500">{stockLabel}</span>
                </>
              )}
            </div>

            {/* CTA principal — pas de "Voir la fiche" puisqu'on EST sur la fiche */}
            <div className="flex flex-col items-start gap-2 w-full">
              <Button
                onClick={handleAddToCart}
                disabled={cartDisabled || addedToCart}
                className={`w-full px-6 py-3.5 rounded-lg text-sm font-bold shadow-md transition-all ${cartDisabled ? 'bg-slate-300 text-slate-100 shadow-none cursor-not-allowed' : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-blue-500/20'}`}
              >
                {addedToCart
                  ? 'Ajouté au panier ✓'
                  : cartDisabled
                    ? 'Indisponible'
                    : 'Ajouter au panier'}
              </Button>
              {currentPrice != null && !cartDisabled && (
                <span className="text-[11px] text-slate-400 font-medium pl-1">
                  ou 3× sans frais de {(currentPrice / 3).toFixed(0)} €
                </span>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Sections d'enrichissement (Phase 2) ───────────────────── */}
        <div className="mt-10 md:mt-14 max-w-5xl mx-auto">
          {/* A. Réassurance */}
          <ReassuranceBand />

          {/* C. État Grade expliqué (suit le sélecteur) */}
          <div className="mt-8">
            <GradeExplainer selectedGrade={selectedGrade} />
          </div>

          {/* F. Souvent achetés ensemble (masqué si aucun accessoire) */}
          {currentPick && (
            <FrequentlyBoughtTogether
              productSkuId={currentPick.skuId}
              productLabel={[
                displayName,
                selectedStorage,
                selectedColor ? colorLabelFr(selectedColor) : null,
              ].filter(Boolean).join(' · ')}
              productImage={heroImage}
              productPrice={currentPrice}
            />
          )}

          {/* B. Caractéristiques techniques (masqué si modèle absent du dict) */}
          <TechSpecs brand={initialSku.brand} model={initialSku.model} />

          {/* D. Avis produit (déjà des étoiles près du titre dans la hero) */}
          <div id="avis">
            <ProductReviews brand={initialSku.brand || 'Apple'} model={initialSku.model || ''} />
          </div>

          {/* G. Ça pourrait bien vous intéresser */}
          {currentPrice != null && (
            <RelatedIphones
              brand={initialSku.brand || 'Apple'}
              model={initialSku.model || ''}
              price={currentPrice}
            />
          )}

          {/* H. Ça s'accorde bien avec (masqué si pas d'accessoire) */}
          <RelatedAccessories />
        </div>
      </div>

      {/* Sticky buy bar — scroll-triggered, suit la sélection en direct */}
      <StickyBuyBar
        brand={initialSku.brand || ''}
        model={initialSku.model || ''}
        image={heroImage}
        storage={selectedStorage}
        color={selectedColor}
        grade={selectedGrade}
        batteryHealth={batteryForGrade}
        price={currentPrice}
        compareAtPrice={originalPrice}
        onAddToCart={handleAddToCart}
        addedToCart={addedToCart}
        disabled={cartDisabled}
      />
    </div>
  );
}
