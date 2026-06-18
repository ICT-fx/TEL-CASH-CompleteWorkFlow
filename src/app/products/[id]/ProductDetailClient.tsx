'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Circle, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import {
  buildVariantMatrix,
  getOptionAvailability,
  normalizeStorage,
  pickInitialSelection,
  pickSkuForSelection,
  reconcileSelection,
  type OptionAvailability,
  type RawProduct,
  type VariantAxis,
} from '@/lib/productVariants';
import { colorToCss, displayGradeLabelFr, displayGrade, displayGradeMeta, DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { getProductReviews } from '@/lib/productReviews';
import { TitleWave } from '@/components/ui/TitleWave';
import { PaymentBadges } from '@/components/products/PaymentBadges';
import { StickyBuyBar } from '@/components/products/StickyBuyBar';
import { ReassuranceBand } from '@/components/products/ReassuranceBand';
import { TechSpecs } from '@/components/products/TechSpecs';
import { GradeExplainer } from '@/components/products/GradeExplainer';
import { VisualStateSelector } from '@/components/products/VisualStateSelector';
import { ProductReviews } from '@/components/products/ProductReviews';
import { FrequentlyBoughtTogether } from '@/components/products/FrequentlyBoughtTogether';
import { RelatedIphones } from '@/components/products/RelatedIphones';
import { RelatedAccessories } from '@/components/products/RelatedAccessories';
import { Stars } from '@/components/products/Stars';

// Phase-1 reskin (hero) + Phase-2 sections d'enrichissement. La hero reprend
// le design de BestSeller.tsx. Toute la logique variantes / panier vient
// toujours de productVariants.ts.
//
// Les données (SKU + frères du même modèle) arrivent en PROPS depuis le
// server component (page.tsx) : premier rendu non vide, metadata/JSON-LD
// possibles, plus de waterfall de fetchs côté client.

interface Props {
  initialSku: RawProduct;
  siblings: RawProduct[];
}

export default function ProductDetailClient({ initialSku, siblings }: Props) {
  const { addItem } = useCart();

  const [addedToCart, setAddedToCart] = useState(false);

  // Sélection initiale stock-aware, calculée une seule fois à partir des
  // props serveur (pas d'effet : les données sont déjà là au premier rendu).
  const [initialSelection] = useState(() => {
    const m = buildVariantMatrix(siblings);
    return pickInitialSelection(m, {
      storage: normalizeStorage(initialSku.storage_capacity),
      grade: displayGrade(initialSku.grade),
      color: (initialSku.color || '').trim() || null,
    });
  });

  // User selection
  const [selectedStorage, setSelectedStorage] = useState<string | null>(initialSelection.storage);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(initialSelection.grade);
  const [selectedColor, setSelectedColor] = useState<string | null>(initialSelection.color);

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

  // Panier invité disponible : plus de redirection vers le login à l'ajout.
  const handleAddToCart = async () => {
    if (!currentPick) return;
    // Find the raw SKU in our siblings list — useCart.addItem expects a product-like object.
    // On force le PRIX DE VENTE COHÉRENT (currentPick.price, A≥B≥C) pour que le
    // panier affiche exactement le prix de la fiche (== prix facturé au checkout).
    const sku = siblings.find((s) => s.id === currentPick.skuId);
    if (!sku) return;
    await addItem({ ...sku, price: currentPick.price } as any);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
  };

  const displayName = `${initialSku.brand} ${initialSku.model}`;
  const currentPrice = currentPick?.price ?? null;
  // Prix « neuf » barré = compare_at_price RÉEL du SKU sélectionné (jamais une
  // valeur inventée). Si absent, on n'affiche simplement pas de prix barré.
  const currentRawSku = currentPick ? siblings.find((s) => s.id === currentPick.skuId) : null;
  const compareAtRaw = currentRawSku ? Number((currentRawSku as { compare_at_price?: number | string }).compare_at_price) : NaN;
  const originalPrice =
    Number.isFinite(compareAtRaw) && currentPrice != null && compareAtRaw > currentPrice
      ? compareAtRaw
      : null;
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

  // Hero image pilotée par la couleur sélectionnée (D4). On route TOUJOURS via
  // resolveProductImage : la photo par couleur (currentPick.image) est passée
  // comme source, mais la blocklist D3 (photos amateur) et le fallback
  // placeholder restent appliqués.
  // strict : la fiche n'affiche QUE la vraie photo de la couleur sélectionnée
  // (sinon placeholder neutre). Jamais une image « gamme » ou une autre couleur.
  const heroImage = resolveProductImage(
    {
      brand: initialSku.brand,
      model: initialSku.model,
      images: currentPick?.image ? [currentPick.image] : (initialSku.images || []),
    },
    selectedColor,
    { strict: true },
  );

  const selectedGradeLetter = displayGrade(selectedGrade);

  // Prix par grade (le moins cher du modèle) pour le sélecteur d'état visuel.
  const visualGrades = DISPLAY_GRADE_ORDER
    .filter((L) => matrix.variants.some((v) => v.grade === L))
    .map((L) => {
      const meta = displayGradeMeta(L);
      const prices = matrix.variants.filter((v) => v.grade === L && v.price > 0).map((v) => v.price);
      return {
        letter: L,
        name: meta?.label ?? L,
        sub: meta?.sub ?? '',
        price: prices.length ? Math.min(...prices) : null,
      };
    });

  // Image par couleur pour les miniatures de la galerie : mapping officiel
  // (MODEL_IMAGES) puis images du SKU frère de CETTE couleur. Sans SKU frère,
  // on retombe sur le placeholder neutre — JAMAIS sur l'image d'une autre
  // couleur (une miniature « verte » qui montre un téléphone bleu est pire
  // qu'une silhouette).
  const colorImage = (c: string) => {
    const sib = siblings.find((s) => (s.color || '').trim() === c);
    return resolveProductImage(
      { brand: initialSku.brand, model: initialSku.model, images: sib?.images || [] },
      c,
      { strict: true },
    );
  };

  // Reviews — déterministes par modèle (cf. productReviews.ts, démo).
  const reviewBundle = getProductReviews(initialSku.brand || 'Apple', initialSku.model || '');

  // Battery health derived from the selected grade (minimum garanti — cf.
  // DISPLAY_GRADES dans lib/products.ts : A=100, B=92, C=85).
  const batteryForGrade = displayGradeMeta(selectedGrade)?.battery ?? null;

  // Stockage réel disponible (hors placeholder « — ») : si aucun, on masque
  // le sélecteur plutôt que d'afficher « STOCKAGE — » (bug iPhone 17 Pro).
  const realStorages = matrix.availableStorages.filter((s) => s !== '—');

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar (non-sticky : remplacée au scroll par StickyBuyBar) */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="container mx-auto px-4 max-w-7xl h-14 flex items-center justify-between">
          <Link href="/products" className="flex items-center gap-2 text-sm font-bold text-[#0A0F1E] hover:text-blue-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Retour à la boutique
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Garantie 24 mois incluse</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Livraison express 24h-48h</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl py-10 md:py-16">

        {/* ── Bloc haut Recommerce : galerie (gauche, sticky desktop) | infos (droite).
            Posé directement sur le fond blanc, pas de carte flottante. ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-10 items-start">

          {/* GAUCHE — galerie : miniatures couleur (vues réelles) + image agrandie.
              Sticky sur desktop (top sous le header), empilée en mobile. */}
          <div className="lg:sticky lg:top-[90px] flex gap-3">
            {matrix.availableColors.length > 1 && (
              <div className="flex flex-col gap-2.5 flex-none">
                {matrix.availableColors.map((c) => {
                  const isSel = selectedColor === c;
                  return (
                    <button
                      key={c}
                      onClick={() => handleOptionClick('color', c)}
                      title={colorLabelFr(c)}
                      aria-label={colorLabelFr(c)}
                      className={`w-[54px] h-[66px] rounded-xl bg-white flex items-center justify-center p-1.5 transition-colors ${isSel ? 'border-2 border-[#2F6BFF]' : 'border border-[#EAEAEA] hover:border-[#cfcfcf]'}`}
                    >
                      <img
                        src={colorImage(c)}
                        alt={colorLabelFr(c)}
                        onError={onImageErrorToPlaceholder(displayName)}
                        className="max-h-full w-auto object-contain"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 bg-white border border-[#F0F0F0] rounded-2xl min-h-[330px] lg:min-h-[460px] flex items-center justify-center p-6 relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 w-[360px] h-[360px] bg-[#2F6BFF]/[0.06] blur-[90px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
              <motion.img
                key={heroImage}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                src={heroImage}
                alt={displayName}
                onError={onImageErrorToPlaceholder(`${initialSku.brand || ''} ${initialSku.model || ''}`.trim())}
                className="relative z-10 w-[85%] max-w-[440px] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)]"
              />
            </div>
          </div>

          {/* DROITE — infos + sélecteurs (défile sous la galerie sticky) */}
          <div className="flex flex-col items-start w-full">
            {/* Badge pill */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#2F6BFF]/10 text-[#2F6BFF] font-bold text-[10px] tracking-widest uppercase mb-3">
              ✦ reconditionné premium
            </div>

            {/* A1 — marque (eyebrow) + modèle (1 ligne) + vague animée */}
            <TitleWave
              eyebrow={(initialSku.brand || '').toUpperCase()}
              title={initialSku.model || ''}
              titleSize="clamp(1.5rem, 3.4vw, 2.2rem)"
            />

            <a
              href="#avis"
              className="inline-flex items-center gap-2 mt-2 mb-3 text-sm font-bold text-[#6B7A99] hover:text-[#0B1437] transition-colors"
            >
              <Stars value={reviewBundle.average} size={14} />
              <span className="tabular-nums">{reviewBundle.average.toFixed(1)}/5</span>
              <span className="text-[#6B7A99]/80 font-medium">· {reviewBundle.count} avis</span>
            </a>

            {/* État ligne — suit le grade sélectionné */}
            {selectedGrade && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7A99] mb-2">
                État : {displayGradeLabelFr(selectedGrade)} {selectedGradeLetter && `(Grade ${selectedGradeLetter})`}
              </p>
            )}

            {/* Price block + mention 3× */}
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              {currentPrice != null ? (
                <>
                  <span className="text-3xl md:text-4xl font-black text-[#0B1437] tracking-tight">
                    {currentPrice.toFixed(0)} €
                  </span>
                  {originalPrice && (
                    <span className="text-sm text-[#6B7A99] font-bold line-through">
                      {originalPrice.toFixed(0)} €
                    </span>
                  )}
                  {savings > 0 && (
                    <span className="text-xs font-bold uppercase tracking-wide bg-[#16A34A]/10 text-[#16A34A] px-2.5 py-1 rounded-full">
                      Économisez {savings} €
                    </span>
                  )}
                </>
              ) : (
                <span className="text-lg font-bold text-[#6B7A99]">Sélectionnez une option valide</span>
              )}
            </div>
            {currentPrice != null && (
              <span className="text-[11px] text-[#6B7A99] font-medium mb-4">
                ou 3× sans frais de {(currentPrice / 3).toFixed(0)} €
              </span>
            )}

            {/* Color selector — round swatches */}
            {matrix.availableColors.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7A99]">
                  Couleur{selectedColor ? ` · ${colorLabelFr(selectedColor)}` : ''}
                </span>
                <div className="flex flex-wrap gap-2">
                  {matrix.availableColors.map((c) => {
                    const avail = getOptionAvailability(matrix, c, 'color', selectedStorage, selectedGrade, null);
                    const isSel = selectedColor === c;
                    return (
                      <button
                        key={c}
                        onClick={() => handleOptionClick('color', c)}
                        title={availTitle(avail, colorLabelFr(c))}
                        aria-label={colorLabelFr(c)}
                        className={`w-7 h-7 rounded-full cursor-pointer shadow-sm border transition-all ${isSel ? 'ring-2 ring-offset-2 ring-[#2F6BFF]' : 'border-[#E7E1D3] hover:ring-2 ring-offset-2 ring-slate-300'} ${avail === 'incompatible' ? 'opacity-30' : avail === 'out_of_stock' ? 'opacity-60' : ''}`}
                        style={{ background: colorToCss(c) }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Storage selector — bottom-border tabs (masqué si aucune capacité
                réelle connue : on n'affiche jamais un onglet « — » seul) */}
            {realStorages.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7A99]">Stockage</span>
                <div className="flex gap-5 flex-wrap">
                  {realStorages.map((s) => {
                    const avail = getOptionAvailability(matrix, s, 'storage', null, selectedGrade, selectedColor);
                    const isSel = selectedStorage === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleOptionClick('storage', s)}
                        title={availTitle(avail, s)}
                        className={`text-sm pb-0.5 border-b-2 transition-all ${isSel ? 'font-bold text-[#0B1437] border-[#2F6BFF]' : 'font-medium text-[#6B7A99] border-transparent hover:text-[#0B1437]'} ${avail === 'incompatible' ? 'opacity-30' : avail === 'out_of_stock' ? 'opacity-60' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Étape 2 (v3) — Sélecteur de grade : médaillon rond SERIF (monogramme)
                qui s'allume en bleu à la sélection + jauge batterie en icône. */}
            {matrix.availableGrades.length > 0 && (
              <div className="w-full mb-4">
                <p className="text-[11px] font-bold tracking-[0.12em] text-[#9AA3B2] mb-2">ÉTAT DU TÉLÉPHONE</p>
                <div className="grid grid-cols-3 gap-3">
                  {matrix.availableGrades.map((g) => {
                    const letter = (displayGrade(g) || g) as DisplayGrade;
                    const meta = displayGradeMeta(g) ?? { label: displayGradeLabelFr(g), sub: '', battery: 0 };
                    const avail = getOptionAvailability(matrix, g, 'grade', selectedStorage, null, selectedColor);
                    const isSel = selectedGrade === g;
                    const epuise = avail === 'out_of_stock';
                    const barW = Math.round((meta.battery / 100) * 20); // sur 20px utiles
                    return (
                      <button
                        key={g}
                        onClick={() => handleOptionClick('grade', g)}
                        title={availTitle(avail, displayGradeLabelFr(g))}
                        className={`relative rounded-[18px] text-center transition-all p-4 ${isSel ? 'border-2 border-[#2F6BFF] bg-[#F7F9FF] shadow-[0_16px_32px_-22px_rgba(47,107,255,0.55)]' : 'border-[1.5px] border-[#E8E8E8] bg-white hover:border-[#cfcfcf]'} ${avail === 'incompatible' ? 'opacity-30' : avail === 'out_of_stock' ? 'opacity-60' : ''}`}
                      >
                        {isSel && (
                          <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#2F6BFF] text-white flex items-center justify-center">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </span>
                        )}
                        {/* Médaillon serif */}
                        <span
                          className={`mx-auto w-14 h-14 rounded-full font-serif ${letter.length > 1 ? 'text-[20px]' : 'text-[27px]'} font-semibold flex items-center justify-center transition-colors ${isSel ? 'bg-[#2F6BFF] text-white border border-[#2F6BFF] shadow-[inset_0_0_0_5px_#F7F9FF]' : 'bg-[#F2F4F8] text-[#0B1437] border border-[#E7EAF1] shadow-[inset_0_0_0_5px_#fff]'}`}
                        >
                          {letter}
                        </span>
                        <p className="text-[10px] tracking-[0.13em] font-bold text-[#A0A6B0] mt-3">GRADE {letter}</p>
                        <p className="text-[15px] font-extrabold text-[#0B1437] mt-1">{meta.label}</p>
                        <p className="text-[11px] text-[#9AA3B2]">{meta.sub}</p>
                        {meta.battery > 0 && (
                          <>
                            <div className="h-px bg-[#F0F0F0] my-3" />
                            <div className="flex items-center justify-center gap-2">
                              <svg width="30" height="15" viewBox="0 0 30 15" aria-hidden="true">
                                <rect x="1" y="2" width="24" height="11" rx="3" fill="none" stroke="#C9CDD6" strokeWidth="1.5" />
                                <rect x="26.5" y="5" width="2.5" height="5" rx="1" fill="#C9CDD6" />
                                <rect x="3" y="4" width={barW} height="7" rx="1.5" fill="#2F6BFF" />
                              </svg>
                              <span className="text-[13px] font-extrabold text-[#0B1437]">≥ {meta.battery} %</span>
                            </div>
                            <p className="text-[9px] text-[#A0A6B0] mt-0.5">minimum garanti</p>
                          </>
                        )}
                        {epuise && (
                          <span className="block mt-2 text-[9px] font-black text-rose-500 uppercase tracking-wider">Épuisé</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock + CTA */}
            <div className="flex items-center gap-2 mb-2.5 text-[11px] font-bold uppercase tracking-widest">
              {currentStock > 0 ? (
                <>
                  <Circle className="w-2 h-2 fill-[#16A34A] text-[#16A34A]" />
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

            <Button
              onClick={handleAddToCart}
              disabled={cartDisabled || addedToCart}
              className={`w-full px-6 py-3.5 rounded-xl text-sm font-bold shadow-md transition-all ${cartDisabled ? 'bg-slate-300 text-slate-100 shadow-none cursor-not-allowed' : 'bg-[#2F6BFF] hover:bg-[#2456d8] text-white shadow-[#2F6BFF]/25'}`}
            >
              {addedToCart
                ? 'Ajouté au panier ✓'
                : cartDisabled
                  ? 'Indisponible'
                  : 'Ajouter au panier'}
            </Button>

            {/* Mini-rappel rassurant au moment du clic */}
            <div className="flex justify-center gap-4 mt-2.5 w-full text-xs text-[#5A6172]">
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#1FA971]" strokeWidth={3} />Garantie 24 mois</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#1FA971]" strokeWidth={3} />Retour 30 jours</span>
            </div>

            {/* Badges de paiement visuels */}
            <PaymentBadges className="mt-3" />
          </div>
        </div>

        {/* ── Sections pleine largeur, sous les 2 colonnes ── */}
        {/* Sélecteur d'état visuel coque/écran (réintroduit, portrait réaliste) */}
        <div className="mt-14 md:mt-20">
          <VisualStateSelector
            grades={visualGrades}
            selectedGrade={selectedGrade}
            onSelectGrade={(g) => handleOptionClick('grade', g)}
          />
        </div>

        {/* Les 3 états expliqués */}
        <div className="mt-12 md:mt-16">
          <GradeExplainer selectedGrade={selectedGrade} />
        </div>

        {/* Réassurance — section « chaude » : accent crème autorisé */}
        <div className="mt-12 md:mt-16">
          <ReassuranceBand />
        </div>

        {/* Souvent achetés ensemble (masqué si aucun accessoire) */}
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
            brand={initialSku.brand}
            model={initialSku.model}
          />
        )}

        {/* Vous aimerez aussi (carrousel iPhones, prix relatif) */}
        {currentPrice != null && (
          <RelatedIphones
            brand={initialSku.brand || 'Apple'}
            model={initialSku.model || ''}
            price={currentPrice}
          />
        )}

        {/* Description & caractéristiques (accordéon specs) */}
        <TechSpecs brand={initialSku.brand} model={initialSku.model} />

        {/* Avis client */}
        <div id="avis">
          <ProductReviews brand={initialSku.brand || 'Apple'} model={initialSku.model || ''} />
        </div>

        {/* Ça s'accorde bien avec (accessoires, masqué si aucun) */}
        <RelatedAccessories />
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
