'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, Store, Truck, ShieldCheck, Undo2, Wrench, CreditCard } from 'lucide-react';
import Link from 'next/link';
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
import { colorToCss, displayGradeLabelFr, displayGrade, displayGradeMeta, DISPLAY_GRADE_ORDER } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { getRealReviewSummary } from '@/lib/realReviews';
import { PaymentBadges } from '@/components/products/PaymentBadges';
import { StickyBuyBar } from '@/components/products/StickyBuyBar';
import { TechSpecs } from '@/components/products/TechSpecs';
import { GradeExplainer } from '@/components/products/GradeExplainer';
import { ProductReviews } from '@/components/products/ProductReviews';
import { FrequentlyBoughtTogether } from '@/components/products/FrequentlyBoughtTogether';
import { RelatedIphones } from '@/components/products/RelatedIphones';
import { RelatedAccessories } from '@/components/products/RelatedAccessories';
import {
  PICKUP_STORE_ADDRESS_LINE1,
  PICKUP_STORE_HOURS_SHORT,
  deliveryWindowLabel,
  formatShippingFee,
} from '@/lib/shipping';

// Refonte v4 (maquettes Fiche-mobile / Fiche-ordi, SPEC 08/10/2026) : H1
// « {modèle} reconditionné », grades Parfait état / Très bon état / État
// correct (lib/grades.ts), aucun prix barré, bloc retrait / livraison.
// Toute la logique variantes / panier vient toujours de productVariants.ts.
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
  const modelName = (initialSku.model || '').trim() || displayName;
  // Alt des images produit : « {modèle} reconditionné » (SPEC accessibilité).
  const imageAlt = `${modelName} reconditionné`;
  const currentPrice = validPick ? validPick.price : null;
  // Refonte v4 : plus AUCUN prix barré ni « Économisez X € » affiché (fiche +
  // barre collante). compare_at_price reste en base, simplement non affiché.
  // Sell-to-order : le stock est purement informatif, jamais bloquant.
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

  // Prix affiché pour un grade dans la configuration courante : la variante
  // exacte (stockage + couleur choisis) si elle est vendable, sinon la moins
  // chère vendable de ce grade au stockage choisi. null = aucun prix.
  const gradePrice = (L: string): number | null => {
    const exact = pickSkuForSelection(matrix, selectedStorage, L, selectedColor);
    if (exact && exact.available) return exact.price;
    const pool = matrix.variants.filter(
      (v) => v.grade === L && v.available && (!selectedStorage || v.storage === selectedStorage),
    );
    return pool.length ? Math.min(...pool.map((v) => v.price)) : null;
  };

  // Options du bloc « Quel état choisir ? » (grades client présents pour ce modèle).
  const explainerOptions = DISPLAY_GRADE_ORDER
    .filter((L) => matrix.variants.some((v) => v.grade === L))
    .map((L) => ({
      letter: L,
      price: gradePrice(L),
      disabled: optionAvail('grade', L) !== 'available',
    }));

  // Note du MAGASIN sur Google (vrais avis, cf. realReviews.ts) — jamais
  // présentée comme une note du produit.
  const storeRating = getRealReviewSummary();
  const storeRatingLabel = `Magasin noté ${storeRating.average.toFixed(1).replace('.', ',')}/5 sur Google (${storeRating.count} avis)`;

  // Batterie minimum garantie du grade sélectionné (GRADE_BATTERY_MIN, lib/grades.ts).
  const batteryForGrade = displayGradeMeta(selectedGrade)?.battery ?? null;

  // Stockage réel disponible (hors placeholder « — ») : si aucun, on masque
  // le sélecteur plutôt que d'afficher « STOCKAGE — » (bug iPhone 17 Pro).
  const realStorages = matrix.availableStorages.filter((s) => s !== '—');

  const subtitle = [
    selectedStorage && selectedStorage !== '—' ? selectedStorage : null,
    selectedColor ? colorLabelFr(selectedColor) : null,
  ].filter(Boolean).join(' · ');

  const fmt2 = (n: number) => n.toFixed(2).replace('.', ',');

  return (
    <div className="min-h-screen bg-white text-[#0A0F1E]">
      <div className="container mx-auto px-4 md:px-6 max-w-[1180px]">
        {/* Fil d'Ariane (cohérent avec le JSON-LD BreadcrumbList) */}
        <nav aria-label="Fil d'Ariane" className="py-3 md:py-5 text-[13px] text-[#5B6478]">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link href="/" className="hover:text-[#2457E6]">Accueil</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/products" className="hover:text-[#2457E6]">Smartphones</Link></li>
            {initialSku.brand && (
              <>
                <li aria-hidden="true" className="hidden md:block">/</li>
                <li className="hidden md:block">
                  <Link href={`/products?brands=${encodeURIComponent(initialSku.brand)}`} className="hover:text-[#2457E6]">
                    {initialSku.brand}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-[#0A0F1E]">{modelName}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-14 items-start">
          {/* GAUCHE — photo (sticky sur ordinateur) */}
          <div className="lg:sticky lg:top-[90px]">
            <div className="relative -mx-4 md:mx-0 h-[240px] sm:h-[320px] lg:h-[460px] md:rounded-[20px] overflow-hidden flex items-center justify-center bg-[radial-gradient(80%_85%_at_50%_35%,#FFFFFF_0%,#EDF1F9_60%,#DFE6F3_100%)]">
              <motion.img
                key={heroImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                src={heroImage}
                alt={imageAlt}
                onError={onImageErrorToPlaceholder(`${initialSku.brand || ''} ${initialSku.model || ''}`.trim())}
                className="h-[200px] sm:h-[270px] lg:h-[380px] w-auto max-w-[85%] object-contain drop-shadow-[0_16px_18px_rgba(11,20,55,0.22)]"
              />
            </div>
          </div>

          {/* DROITE — l'essentiel : nom, prix, état, couleur, stockage, bouton */}
          <div className="flex flex-col gap-3.5 md:gap-4 w-full min-w-0">
            <div className="flex flex-col gap-1">
              {initialSku.brand && (
                <span className="hidden md:block text-[13px] font-bold tracking-[0.08em] uppercase text-[#5B6478]">
                  {initialSku.brand}
                </span>
              )}
              <h1 className="m-0 text-[26px] md:text-[38px] leading-[1.15] font-extrabold tracking-[-0.02em]">
                {modelName} reconditionné
              </h1>
              {subtitle && <span className="text-[15px] font-semibold text-[#47506A]">{subtitle}</span>}
              <a href="#avis" className="inline-flex items-center gap-1.5 min-h-[32px] text-[14px] font-semibold text-[#47506A] hover:text-[#0A0F1E]">
                <Star className="w-[15px] h-[15px] fill-[#F5A524] text-[#F5A524]" aria-hidden="true" />
                {storeRatingLabel}
              </a>
            </div>

            {/* Prix (jamais de prix barré) + Klarna */}
            <div className="flex items-baseline gap-2.5 flex-wrap">
              {currentPrice != null ? (
                <>
                  <span className="text-[34px] md:text-[40px] font-extrabold tracking-[-0.02em] leading-none">
                    {currentPrice.toFixed(0)} €
                  </span>
                  <span className="text-[14px] font-semibold text-[#47506A]">
                    ou 3× {fmt2(currentPrice / 3)} € sans frais<span className="hidden md:inline"> avec Klarna</span>
                  </span>
                </>
              ) : (
                <span className="text-[17px] font-bold text-[#5B6478]">Sélectionnez une option valide</span>
              )}
            </div>

            {/* État */}
            {matrix.availableGrades.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[14px] font-bold">
                  État
                  <a href="#etats" className="inline-flex items-center min-h-[44px] text-[14px] font-semibold text-[#2457E6] hover:text-[#163DAA]">
                    Voir la différence
                  </a>
                </div>
                <div className={`grid gap-2 ${matrix.availableGrades.length >= 3 ? 'grid-cols-3' : matrix.availableGrades.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {matrix.availableGrades.map((g) => {
                    const meta = displayGradeMeta(g);
                    const label = meta?.label ?? displayGradeLabelFr(g);
                    const avail = optionAvail('grade', g);
                    const isSel = selectedGrade === g;
                    const price = gradePrice(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleOptionClick('grade', g)}
                        disabled={avail !== 'available'}
                        aria-pressed={isSel}
                        title={availTitle(avail, label)}
                        className={`flex flex-col items-start gap-0.5 min-w-0 min-h-[44px] px-2.5 pt-2.5 pb-[11px] rounded-[14px] text-left transition-colors ${
                          isSel
                            ? 'border-2 border-[#2457E6] bg-[linear-gradient(180deg,#FAFBFF,#E9EFFF)] shadow-[inset_0_1px_0_#fff,0_10px_20px_-14px_rgba(36,87,230,0.7)]'
                            : 'border-[1.5px] border-[#E4E8F0] bg-white hover:border-[#C9D3E6]'
                        } ${avail !== 'available' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="text-[14px] font-bold leading-tight">{label}</span>
                        {price != null && <b className="text-[17px]">{price.toFixed(0)} €</b>}
                        {meta && (
                          <span className="text-[13px] font-semibold text-[#47506A] whitespace-nowrap">
                            Batt. ≥ {meta.battery} %
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Couleur */}
            {matrix.availableColors.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3 text-[14px] font-bold">
                  Couleur
                  {selectedColor && <span className="font-semibold text-[#5B6478] truncate">{colorLabelFr(selectedColor)}</span>}
                </div>
                <div className="flex flex-wrap gap-2.5 pl-0.5">
                  {matrix.availableColors.map((c) => {
                    const avail = optionAvail('color', c);
                    const isSel = selectedColor === c;
                    const unavailable = avail !== 'available';
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleOptionClick('color', c)}
                        disabled={unavailable}
                        aria-pressed={isSel}
                        title={availTitle(avail, colorLabelFr(c))}
                        aria-label={`${colorLabelFr(c)}${unavailable ? ' — indisponible' : ''}`}
                        className={`relative w-11 h-11 flex-none rounded-full border border-[rgba(11,20,55,0.15)] overflow-hidden transition-shadow ${
                          isSel ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_#2457E6]' : 'hover:shadow-[0_0_0_2px_#fff,0_0_0_4px_#C9D3E6]'
                        } ${unavailable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        style={{ background: colorToCss(c) }}
                      >
                        {/* Indisponible : voile clair + barre oblique sombre. */}
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

            {/* Stockage (masqué si aucune capacité réelle connue) */}
            {realStorages.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-[14px] font-bold">
                  Stockage
                  <span className="font-semibold text-[#5B6478] text-right">Le prix s&apos;ajuste selon le stockage</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {realStorages.map((s) => {
                    const avail = optionAvail('storage', s);
                    const isSel = selectedStorage === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleOptionClick('storage', s)}
                        disabled={avail !== 'available'}
                        aria-pressed={isSel}
                        title={availTitle(avail, s)}
                        className={`h-11 rounded-xl text-[15px] font-bold flex items-center justify-center transition-colors ${
                          isSel
                            ? 'border-2 border-[#2457E6] bg-[linear-gradient(180deg,#FAFBFF,#E9EFFF)] shadow-[inset_0_1px_0_#fff,0_8px_16px_-12px_rgba(36,87,230,0.7)]'
                            : 'border-[1.5px] border-[#E4E8F0] bg-white hover:border-[#C9D3E6]'
                        } ${avail !== 'available' ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={cartDisabled || addedToCart}
              className={`tc-btn w-full !text-[17px] ${cartDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {addedToCart ? 'Ajouté au panier ✓' : cartDisabled ? 'Indisponible' : 'Ajouter au panier'}
            </button>

            {/* Retrait / livraison (constantes lib/shipping.ts) */}
            <div className="flex flex-col gap-2.5 p-3.5 rounded-[14px] bg-[#F9F8F5]">
              <p className="flex items-start gap-2.5 text-[14px] leading-[1.45]">
                <Store className="w-[18px] h-[18px] mt-px flex-none text-[#157F3D]" strokeWidth={2.2} aria-hidden="true" />
                <span>
                  <b>Retrait gratuit le jour même</b> au {PICKUP_STORE_ADDRESS_LINE1}, Angers · {PICKUP_STORE_HOURS_SHORT}
                </span>
              </p>
              <p className="flex items-start gap-2.5 text-[14px] leading-[1.45]">
                <Truck className="w-[18px] h-[18px] mt-px flex-none text-[#2457E6]" aria-hidden="true" />
                <span>
                  <b>Livraison suivie {formatShippingFee()}</b> · reçue sous {deliveryWindowLabel()}
                </span>
              </p>
            </div>

            {/* Réassurance */}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5 py-1 text-[14px] leading-[1.45]">
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="w-[18px] h-[18px] mt-px flex-none text-[#2457E6]" aria-hidden="true" />Garantie 24 mois
              </li>
              <li className="flex items-start gap-2.5">
                <Undo2 className="w-[18px] h-[18px] mt-px flex-none text-[#2457E6]" aria-hidden="true" />Retour sous 30 jours
              </li>
              <li className="flex items-start gap-2.5">
                <Wrench className="w-[18px] h-[18px] mt-px flex-none text-[#2457E6]" aria-hidden="true" />Contrôlé dans notre atelier
              </li>
              <li className="flex items-start gap-2.5">
                <CreditCard className="w-[18px] h-[18px] mt-px flex-none text-[#2457E6]" aria-hidden="true" />Paiement sécurisé
              </li>
            </ul>

            {/* Moyens de paiement (dont Klarna 3× / 4× sans frais) */}
            <PaymentBadges />
          </div>
        </div>
      </div>

      {/* ── Souvent pris avec + Caractéristiques (fond chaud) ──
          Masqué si aucun des deux blocs n'a de contenu. */}
      <section className="mt-12 md:mt-20 bg-[#F9F8F5] py-10 md:py-16 [&:not(:has(section))]:hidden">
        <div className="container mx-auto px-4 md:px-6 max-w-[1180px] grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-start">
          {validPick && (
            <div className="min-w-0 [&>section]:mt-0">
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
            </div>
          )}
          <div className="min-w-0">
            <TechSpecs brand={initialSku.brand} model={initialSku.model} specs={initialSku.specs} warranty={initialSku.warranty} />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 md:px-6 max-w-[1180px]">
        {/* Quel état choisir ? (#etats, cible de « Voir la différence ») */}
        <div className="mt-12 md:mt-16">
          <GradeExplainer
            selectedGrade={selectedGrade}
            options={explainerOptions}
            onSelectGrade={(g) => handleOptionClick('grade', g)}
          />
        </div>

        {/* Garantie et retours */}
        <section aria-labelledby="garantie-titre" className="mt-10 md:mt-14 flex flex-col gap-2.5 text-[14px] md:text-[15px] leading-relaxed">
          <h2 id="garantie-titre" className="text-[22px] md:text-[28px] font-extrabold tracking-[-0.02em]">Garantie et retours</h2>
          <p>
            <b>Garantie 24 mois</b>, pièces et main d&apos;œuvre, en magasin ou par envoi. Elle s&apos;ajoute à la garantie légale de conformité.
          </p>
          <p>
            <b>30 jours pour retourner un achat fait en ligne.</b>{' '}
            <Link href="/retours" className="font-semibold text-[#2457E6] hover:text-[#163DAA]">Conditions de retour</Link>
          </p>
        </section>
      </div>

      {/* Avis Google du magasin */}
      <div id="avis" className="mt-12 md:mt-16 bg-[#F9F8F5] md:bg-transparent py-6 md:py-0 scroll-mt-24">
        <div className="container mx-auto px-4 md:px-6 max-w-[1180px]">
          <ProductReviews brand={initialSku.brand || 'Apple'} model={initialSku.model || ''} />
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 max-w-[1180px] pb-24 lg:pb-16">
        {/* Vous aimerez aussi (carrousel, prix relatif) */}
        {currentPrice != null && (
          <RelatedIphones
            brand={initialSku.brand || 'Apple'}
            model={initialSku.model || ''}
            price={currentPrice}
          />
        )}

        {/* Ça s'accorde bien avec (accessoires, masqué si aucun) */}
        <RelatedAccessories />
      </div>

      {/* Barre d'achat collante (mobile) — suit la sélection en direct */}
      <StickyBuyBar
        brand={initialSku.brand || ''}
        model={initialSku.model || ''}
        image={heroImage}
        storage={selectedStorage}
        color={selectedColor}
        grade={selectedGrade}
        batteryHealth={batteryForGrade}
        price={currentPrice}
        onAddToCart={handleAddToCart}
        addedToCart={addedToCart}
        disabled={cartDisabled}
      />
    </div>
  );
}
