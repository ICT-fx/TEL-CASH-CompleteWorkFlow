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
import { SHIPPING_DELAY_LABEL } from '@/lib/shipping';

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

  // Vendable = prix > 0 ET non grisé par le fournisseur (rupture Fluxitron fraîche).
  // Le prix affiché et l'ajout au panier sont réservés aux variantes vendables :
  // si tout le modèle est en rupture fournisseur, l'ajout reste bloqué.
  const validPick = currentPick && currentPick.available ? currentPick : null;

  // Disponibilité d'une option avec le BON contexte par axe :
  //   stockage → indépendant du grade/couleur (vendable si un prix existe à ce stockage)
  //   grade    → dépend du stockage choisi (« grade A pour 128 Go » grisé si sans prix)
  //   couleur  → dépend du stockage + grade choisis
  const optionAvail = (axis: VariantAxis, value: string): OptionAvailability =>
    axis === 'storage'
      ? getOptionAvailability(matrix, value, 'storage', null, null, null)
      : axis === 'grade'
        ? getOptionAvailability(matrix, value, 'grade', selectedStorage, null, null)
        : getOptionAvailability(matrix, value, 'color', selectedStorage, selectedGrade, null);

  const handleOptionClick = (axis: VariantAxis, value: string) => {
    const current = { storage: selectedStorage, grade: selectedGrade, color: selectedColor };
    // Règle prix : une option grisée (combinaison inexistante OU sans prix défini)
    // n'est PAS sélectionnable → on ignore le clic.
    if (optionAvail(axis, value) !== 'available') return;

    // Réconcilie vers une variante VENDABLE (prix > 0) en préservant au maximum
    // les autres axes courants.
    const next = reconcileSelection(matrix, axis, value, current);
    if (next) {
      setSelectedStorage(next.storage);
      setSelectedGrade(next.grade);
      setSelectedColor(next.color);
    }
  };

  // Panier invité disponible : plus de redirection vers le login à l'ajout.
  const handleAddToCart = async () => {
    if (!validPick) return;
    // Find the raw SKU in our siblings list — useCart.addItem expects a product-like object.
    // On force le PRIX DE VENTE COHÉRENT (validPick.price, A≥B≥C) pour que le
    // panier affiche exactement le prix de la fiche (== prix facturé au checkout).
    const sku = siblings.find((s) => s.id === validPick.skuId);
    if (!sku) return;
    const result = await addItem({ ...sku, price: validPick.price } as any);
    // Échec → un toast a déjà été affiché ; pas de faux « Ajouté ✓ ».
    if (!result.ok) return;
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
  };

  const displayName = `${initialSku.brand} ${initialSku.model}`;
  const currentPrice = validPick ? validPick.price : null;
  // Prix « neuf » barré = compare_at_price RÉEL du SKU sélectionné (jamais une
  // valeur inventée). Si absent, on n'affiche simplement pas de prix barré.
  const currentRawSku = validPick ? siblings.find((s) => s.id === validPick.skuId) : null;
  const compareAtRaw = currentRawSku ? Number((currentRawSku as { compare_at_price?: number | string }).compare_at_price) : NaN;
  const originalPrice =
    Number.isFinite(compareAtRaw) && currentPrice != null && compareAtRaw > currentPrice
      ? compareAtRaw
      : null;
  const savings = currentPrice && originalPrice ? Math.round(originalPrice - currentPrice) : 0;
  // Sell-to-order : le stock est purement informatif, jamais bloquant.
  const currentStock = currentPick?.stock ?? 0;
  // Le bouton n'est actif que pour une variante VENDABLE (prix > 0).
  const cartDisabled = !validPick;

  // Tooltip d'accessibilité par option :
  //   'available'    → libellé brut
  //   'incompatible' → avertit que la combinaison n'existe pas
  //   'out_of_stock' → n'est plus renvoyé (sell-to-order), cas mort
  const availTitle = (avail: OptionAvailability, label: string): string | undefined => {
    if (avail === 'available') return label;
    if (avail === 'out_of_stock') return `${label} — bientôt disponible`;
    return `${label} — combinaison indisponible`;
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
      // Grisé si, pour le stockage courant, ce grade n'a pas de prix défini.
      const avail = getOptionAvailability(matrix, L, 'grade', selectedStorage, null, null);
      return {
        letter: L,
        name: meta?.label ?? L,
        sub: meta?.sub ?? '',
        price: prices.length ? Math.min(...prices) : null,
        disabled: avail !== 'available',
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

  // Grades sur UNE seule ligne en mobile : autant de colonnes que de grades
  // (classes Tailwind littérales pour rester compatibles JIT). Desktop inchangé.
  const gradeColsClass =
    ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as Record<number, string>)[
      Math.min(matrix.availableGrades.length, 4)
    ] || 'grid-cols-3';

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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{SHIPPING_DELAY_LABEL}</span>
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

            {/* Price block */}
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

            {/* Color selector — round swatches */}
            {matrix.availableColors.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7A99]">
                  Couleur{selectedColor ? ` · ${colorLabelFr(selectedColor)}` : ''}
                </span>
                <div className="flex flex-wrap gap-2">
                  {matrix.availableColors.map((c) => {
                    const avail = optionAvail('color', c);
                    const isSel = selectedColor === c;
                    const unavailable = avail !== 'available';
                    return (
                      <button
                        key={c}
                        onClick={() => handleOptionClick('color', c)}
                        disabled={unavailable}
                        title={availTitle(avail, colorLabelFr(c))}
                        aria-label={`${colorLabelFr(c)}${unavailable ? ' — épuisé' : ''}`}
                        className={`relative w-8 h-8 sm:w-7 sm:h-7 rounded-full shadow-sm border overflow-hidden transition-all ${isSel ? 'ring-2 ring-offset-2 ring-[#2F6BFF]' : 'border-[#E7E1D3] hover:ring-2 ring-offset-2 ring-slate-300'} ${unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{ background: colorToCss(c) }}
                      >
                        {/* Hors stock : voile clair (atténue la couleur) + barre oblique
                            sombre — lisible sur n'importe quelle teinte, y compris sur mobile. */}
                        {unavailable && (
                          <span aria-hidden className="absolute inset-0">
                            <span className="absolute inset-0 bg-white/60" />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="block w-[200%] h-[2px] rotate-45 bg-slate-600" />
                            </span>
                          </span>
                        )}
                      </button>
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
                    const avail = optionAvail('storage', s);
                    const isSel = selectedStorage === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleOptionClick('storage', s)}
                        disabled={avail !== 'available'}
                        title={availTitle(avail, s)}
                        className={`text-sm pb-0.5 border-b-2 transition-all ${isSel ? 'font-bold text-[#0B1437] border-[#2F6BFF]' : 'font-medium text-[#6B7A99] border-transparent hover:text-[#0B1437]'} ${avail !== 'available' ? 'opacity-30 cursor-not-allowed' : ''}`}
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
                <div className={`grid ${gradeColsClass} sm:grid-cols-4 gap-2 sm:gap-3`}>
                  {matrix.availableGrades.map((g) => {
                    const letter = (displayGrade(g) || g) as DisplayGrade;
                    const meta = displayGradeMeta(g) ?? { badge: String(g), label: displayGradeLabelFr(g), sub: '', battery: 0 };
                    const avail = optionAvail('grade', g);
                    const isSel = selectedGrade === g;
                    const barW = Math.round((meta.battery / 100) * 20); // sur 20px utiles
                    return (
                      <button
                        key={g}
                        onClick={() => handleOptionClick('grade', g)}
                        disabled={avail !== 'available'}
                        title={availTitle(avail, displayGradeLabelFr(g))}
                        className={`relative rounded-[18px] text-center transition-all p-2 sm:p-4 ${isSel ? 'border-2 border-[#2F6BFF] bg-[#F7F9FF] shadow-[0_16px_32px_-22px_rgba(47,107,255,0.55)]' : 'border-[1.5px] border-[#E8E8E8] bg-white hover:border-[#cfcfcf]'} ${avail !== 'available' ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
                      >
                        {isSel && (
                          <span className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#2F6BFF] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
                          </span>
                        )}
                        {/* Médaillon serif */}
                        <span
                          className={`mx-auto w-10 h-10 sm:w-14 sm:h-14 rounded-full font-serif text-[19px] sm:text-[27px] font-semibold flex items-center justify-center transition-colors ${isSel ? 'bg-[#2F6BFF] text-white border border-[#2F6BFF] shadow-[inset_0_0_0_5px_#F7F9FF]' : 'bg-[#F2F4F8] text-[#0B1437] border border-[#E7EAF1] shadow-[inset_0_0_0_4px_#fff] sm:shadow-[inset_0_0_0_5px_#fff]'}`}
                        >
                          {meta.badge}
                        </span>
                        <p className="text-[9px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.13em] font-bold text-[#A0A6B0] mt-2 sm:mt-3">GRADE {letter.toUpperCase()}</p>
                        <p className="text-[12px] sm:text-[15px] font-extrabold text-[#0B1437] mt-0.5 sm:mt-1 leading-tight">{meta.label}</p>
                        <p className="text-[10px] sm:text-[11px] text-[#9AA3B2] leading-tight">{meta.sub}</p>
                        {meta.battery > 0 && (
                          <>
                            <div className="h-px bg-[#F0F0F0] my-2 sm:my-3" />
                            <div className="flex items-center justify-center gap-1 sm:gap-2">
                              <svg width="30" height="15" viewBox="0 0 30 15" aria-hidden="true" className="w-[24px] h-[12px] sm:w-[30px] sm:h-[15px] flex-none">
                                <rect x="1" y="2" width="24" height="11" rx="3" fill="none" stroke="#C9CDD6" strokeWidth="1.5" />
                                <rect x="26.5" y="5" width="2.5" height="5" rx="1" fill="#C9CDD6" />
                                <rect x="3" y="4" width={barW} height="7" rx="1.5" fill="#2F6BFF" />
                              </svg>
                              <span className="text-[11px] sm:text-[13px] font-extrabold text-[#0B1437] whitespace-nowrap">
                                {meta.battery >= 100 ? '≈ 100 %' : `≥ ${meta.battery} %`}
                              </span>
                            </div>
                            <p className="text-[9px] text-[#A0A6B0] mt-0.5">
                              {meta.battery >= 100 ? 'environ' : 'minimum garanti'}
                            </p>
                          </>
                        )}
                        {/* Sell-to-order : aucun badge « Épuisé » — toute variante active est commandable */}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Disponibilité + CTA — sell-to-order : toujours disponible à la commande */}
            <div className="flex items-center gap-2 mb-2.5 text-[11px] font-bold uppercase tracking-widest">
              <Circle className="w-2 h-2 fill-[#16A34A] text-[#16A34A]" />
              <span className="text-emerald-600">
                {currentPrice != null ? 'Disponible à la commande' : 'Sélectionnez une configuration'}
              </span>
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
        {validPick && (
          <FrequentlyBoughtTogether
            productSkuId={validPick.skuId}
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
        <TechSpecs brand={initialSku.brand} model={initialSku.model} specs={initialSku.specs} warranty={initialSku.warranty} />

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
