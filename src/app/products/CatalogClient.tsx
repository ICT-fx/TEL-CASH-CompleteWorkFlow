'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown, Check, RotateCcw, Sparkles, Loader2, ArrowRight, Search, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { groupSkusByModel, type RawProduct } from '@/lib/productVariants';
import { displayGrade, displayGradeLabelFr, DISPLAY_GRADE_ORDER } from '@/lib/products';
import { resolveProductImage, resolveModelCardImage, onImageErrorToPlaceholder } from '@/lib/productImage';

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Listing unifié : téléphones (défaut) ou accessoires selon ?category=.
  // Un accessoire = produit simple (pas de grade/couleur/stockage/variantes).
  const isAccessories = searchParams.get('category') === 'accessoires';
  const categoryParam = isAccessories ? 'accessoires' : 'telephones';

  const [products, setProducts] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      // fields=card : on ne rapatrie que les colonnes utiles aux cartes.
      const res = await fetch(`/api/products?category=${categoryParam}&limit=all&fields=card`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        setFetchError(true);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [categoryParam]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Initial brand filter from URL (?brand=apple|android)
  const initialBrand = searchParams.get('brand');
  const initialBrands = useMemo(() => {
    if (initialBrand === 'apple') return ['Apple'];
    if (initialBrand === 'android') return ['Samsung', 'Xiaomi', 'Google'];
    return [];
  }, [initialBrand]);

  // Filtres initialisés depuis l'URL : un lien partagé ou un retour arrière
  // restaure exactement la même vue (cf. effet de synchronisation plus bas).
  const csv = (key: string) =>
    (searchParams.get(key) || '').split(',').map((s) => s.trim()).filter(Boolean);
  const VALID_SORTS = ['popular', 'price-asc', 'price-desc', 'name'] as const;
  type SortKey = (typeof VALID_SORTS)[number];
  const initialSort = searchParams.get('sort');

  const [brandFilter, setBrandFilter] = useState<string[]>(
    () => (csv('brands').length > 0 ? csv('brands') : initialBrands),
  );
  const [gradeFilter, setGradeFilter] = useState<string[]>(() => csv('grades'));
  const [storageFilter, setStorageFilter] = useState<string[]>(() => csv('storages'));
  // Plafond de prix choisi par le client. null = aucun plafond (= afficher
  // jusqu'au prix le plus cher du catalogue). On NE borne plus en dur à 1500 €,
  // sinon les modèles dont la marge dépasse 1500 € disparaissent du catalogue.
  const [priceMax, setPriceMax] = useState<number | null>(() => {
    const m = parseInt(searchParams.get('prix_max') || '', 10);
    return Number.isFinite(m) && m > 0 ? m : null;
  });
  const [sortBy, setSortBy] = useState<SortKey>(
    () => (VALID_SORTS.includes(initialSort as SortKey) ? (initialSort as SortKey) : 'popular'),
  );
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [showAllBrands, setShowAllBrands] = useState(false);

  // Plafond du slider = prix le plus cher du catalogue (arrondi à la centaine
  // supérieure, plancher 1500 €). S'adapte automatiquement aux prix margés.
  const priceCeiling = useMemo(() => {
    let max = 0;
    for (const p of products) {
      if (!p.is_active) continue;
      const pr = typeof p.price === 'string' ? parseFloat(p.price) : (p.price as number);
      if (Number.isFinite(pr) && pr > max) max = pr;
    }
    return Math.max(1500, Math.ceil(max / 100) * 100);
  }, [products]);
  const effectiveMax = priceMax ?? priceCeiling;

  useEffect(() => {
    if (initialBrand) setBrandFilter(initialBrands);
  }, [initialBrands, initialBrand]);

  // Filtres → URL (replace, débouncé) : partage et retour arrière fiables,
  // sans empiler une entrée d'historique à chaque frappe.
  const urlSyncTimer = useRef<number | null>(null);
  useEffect(() => {
    if (urlSyncTimer.current) window.clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (isAccessories) params.set('category', 'accessoires'); // ne pas perdre le contexte
      if (brandFilter.length > 0) params.set('brands', brandFilter.join(','));
      if (gradeFilter.length > 0) params.set('grades', gradeFilter.join(','));
      if (storageFilter.length > 0) params.set('storages', storageFilter.join(','));
      if (priceMax != null && priceMax < priceCeiling) params.set('prix_max', String(priceMax));
      if (sortBy !== 'popular') params.set('sort', sortBy);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const qs = params.toString();
      router.replace(qs ? `/products?${qs}` : '/products', { scroll: false });
    }, 300);
    return () => {
      if (urlSyncTimer.current) window.clearTimeout(urlSyncTimer.current);
    };
  }, [isAccessories, brandFilter, gradeFilter, storageFilter, priceMax, priceCeiling, sortBy, searchQuery, router]);

  // Recherche lancée depuis le header alors qu'on est déjà sur /products :
  // le composant reste monté, on doit suivre les changements de ?q.
  const urlQ = searchParams.get('q') || '';
  useEffect(() => {
    setSearchQuery(urlQ);
  }, [urlQ]);

  // Fermeture du drawer de filtres à Échap (dialog accessible).
  useEffect(() => {
    if (!isMobileFiltersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileFiltersOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileFiltersOpen]);

  // Marques dérivées du catalogue réel (et non figées) : toute marque ajoutée
  // côté admin apparaît automatiquement dans le filtre.
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.is_active && p.brand) set.add(p.brand.trim());
    }
    // On garde une cohérence d'ordre : marques par défaut d'abord, puis le reste A→Z.
    const preferred = ['Apple', 'Samsung', 'Xiaomi', 'Google'];
    const rest = Array.from(set).filter((b) => !preferred.includes(b)).sort((a, b) => a.localeCompare(b, 'fr'));
    return [...preferred.filter((b) => set.has(b)), ...rest];
  }, [products]);

  // Nombre de MODÈLES actifs par marque (pas de SKU) — affiché à côté de chaque
  // marque. Une carte = un modèle, donc le compteur doit refléter les modèles
  // (Apple ≈ nb de modèles, pas 2702 variantes).
  const brandCounts = useMemo(() => {
    const seen = new Map<string, Set<string>>();
    for (const p of products) {
      const b = p.brand?.trim();
      const model = (p.model || '').trim();
      if (p.is_active && b && model) {
        if (!seen.has(b)) seen.set(b, new Set());
        seen.get(b)!.add(model.toLowerCase());
      }
    }
    const m = new Map<string, number>();
    seen.forEach((models, b) => m.set(b, models.size));
    return m;
  }, [products]);

  const BRANDS_COLLAPSED = 4;
  const visibleBrands = showAllBrands ? allBrands : allBrands.slice(0, BRANDS_COLLAPSED);
  // Boutique : 3 grades client uniquement (A/B/C). Les sous-grades (A+, C+) et
  // les D/E sont repliés/exclus côté affichage et filtrage.
  const grades = DISPLAY_GRADE_ORDER;
  const storages = ['64', '128', '256', '512'];

  // 1) Filter SKUs FIRST (so model cards adapt to the active filters).
  // 2) Group the filtered SKUs by (brand, model) — models with no matching SKU
  //    automatically drop out (EXISTS semantics).
  const visibleModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filteredSkus = products.filter((p) => {
      if (!p.is_active) return false;
      if (q && !`${p.brand || ''} ${p.model || ''}`.toLowerCase().includes(q)) return false;
      // Accessoires : produits simples → on ignore les filtres marque/grade/
      // stockage (sinon un filtre téléphone résiduel masquerait tout).
      if (!isAccessories) {
        if (brandFilter.length > 0 && !brandFilter.includes(p.brand || '')) return false;
        if (gradeFilter.length > 0) {
          const letter = displayGrade(p.grade);
          if (!letter || !gradeFilter.includes(letter)) return false;
        }
      }
      if (!isAccessories && storageFilter.length > 0) {
        const sc = (p.storage_capacity || '').toString();
        if (!storageFilter.some((s) => sc.includes(s))) return false;
      }
      const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
      if (!Number.isFinite(price as number)) return false;
      if ((price as number) > effectiveMax) return false;
      return true;
    });

    const grouped = groupSkusByModel(filteredSkus);

    switch (sortBy) {
      case 'price-asc':
        grouped.sort((a, b) => a.minPrice - b.minPrice);
        break;
      case 'price-desc':
        grouped.sort((a, b) => b.maxPrice - a.maxPrice);
        break;
      case 'name':
        grouped.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'fr'));
        break;
      case 'popular':
      default:
        grouped.sort((a, b) => a.brand.localeCompare(b.brand, 'fr') || a.model.localeCompare(b.model, 'fr'));
    }

    return grouped;
  }, [isAccessories, products, searchQuery, brandFilter, gradeFilter, storageFilter, effectiveMax, sortBy]);

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const resetFilters = () => {
    setBrandFilter([]);
    setGradeFilter([]);
    setStorageFilter([]);
    setPriceMax(null);
    setSearchQuery('');
    router.push('/products', { scroll: false });
  };

  const activeFilterCount =
    brandFilter.length + gradeFilter.length + storageFilter.length +
    (priceMax != null && priceMax < priceCeiling ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
      <section className="bg-white border-b border-slate-100 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#3b82f6] font-caveat text-2xl md:text-3xl -rotate-2 inline-block">
                {isAccessories ? 'pour aller avec' : 'le meilleur du reconditionné'}
              </span>
              <Sparkles className="w-5 h-5 text-yellow-400 opacity-60 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-[#0A0F1E] mb-4">
              {isAccessories ? 'Nos Accessoires' : 'Nos Smartphones'}
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl font-medium">
              {isAccessories
                ? 'Chargeurs, batteries, écouteurs et câbles — de quoi équiper votre téléphone.'
                : 'Découvrez notre sélection de smartphones expertisés et garantis 24 mois.'}
            </p>

            {/* Barre de recherche produit */}
            <div className="w-full max-w-2xl mt-8">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAccessories ? 'Rechercher un accessoire (chargeur, batterie...)' : 'Rechercher un produit (ex. iPhone 13, Galaxy S22...)'}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-14 pr-12 py-4 text-sm font-medium text-[#0A0F1E] placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-[#3b82f6] transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-7xl py-12">
        <div className="flex flex-col lg:flex-row gap-12">

          <aside className="hidden lg:block w-[280px] shrink-0 space-y-8 sticky top-32 h-fit">
            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-[#0A0F1E]">Filtres</h2>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-xs font-bold text-[#3b82f6] hover:underline flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Réinitialiser
                  </button>
                )}
              </div>

              {!isAccessories && (
              <div className="mb-8">
                <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">Marque</h3>
                <div className="space-y-3">
                  {visibleBrands.map((brand) => (
                    <label key={brand} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={brandFilter.includes(brand)}
                          onChange={() => toggleFilter(brandFilter, setBrandFilter, brand)}
                        />
                        <div className="w-5 h-5 rounded-md border-2 border-slate-200 peer-checked:bg-[#3b82f6] peer-checked:border-[#3b82f6] transition-all" />
                        <Check className="w-3 h-3 text-white absolute left-1 opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-[#0A0F1E] transition-colors">
                        {brand} <span className="font-medium text-slate-400">({brandCounts.get(brand) || 0})</span>
                      </span>
                    </label>
                  ))}
                </div>
                {allBrands.length > BRANDS_COLLAPSED && (
                  <button
                    onClick={() => setShowAllBrands((v) => !v)}
                    className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#3b82f6] hover:underline"
                  >
                    {showAllBrands ? (
                      <><Minus className="w-3.5 h-3.5" /> Voir moins</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Voir plus ({allBrands.length - BRANDS_COLLAPSED})</>
                    )}
                  </button>
                )}
              </div>
              )}

              <div className="mb-8">
                <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">Prix max : {effectiveMax}€</h3>
                <input
                  type="range"
                  min="0"
                  max={priceCeiling}
                  step="50"
                  value={effectiveMax}
                  onChange={(e) => setPriceMax(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                />
              </div>

              {/* Stockage + Grade : filtres spécifiques aux téléphones, masqués
                  pour les accessoires (produits simples sans variantes). */}
              {!isAccessories && (
                <>
                  <div className="mb-8">
                    <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">Stockage</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {storages.map((storage) => (
                        <button
                          key={storage}
                          onClick={() => toggleFilter(storageFilter, setStorageFilter, storage)}
                          className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${storageFilter.includes(storage) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-50 text-slate-400 hover:border-slate-200'}`}
                        >
                          {storage} Go
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">Grade</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {grades.map((grade) => (
                        <button
                          key={grade}
                          onClick={() => toggleFilter(gradeFilter, setGradeFilter, grade)}
                          title={displayGradeLabelFr(grade)}
                          className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${gradeFilter.includes(grade) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-50 text-slate-400 hover:border-slate-200'}`}
                        >
                          {`Grade ${grade}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>

          <main className="flex-grow">
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm font-bold text-slate-600">
                {visibleModels.length} {isAccessories ? 'accessoire' : 'modèle'}{visibleModels.length > 1 ? 's' : ''} trouvé{visibleModels.length > 1 ? 's' : ''}
              </span>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 text-sm font-bold shadow-sm"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filtres
                </button>

                <div className="relative group">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="appearance-none bg-white border border-slate-100 rounded-full px-6 py-2.5 pr-10 text-sm font-bold text-[#0A0F1E] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                  >
                    <option value="popular">Pertinence</option>
                    <option value="price-asc">Prix croissant</option>
                    <option value="price-desc">Prix décroissant</option>
                    <option value="name">Nom A → Z</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
            ) : fetchError ? (
              <div className="bg-white rounded-3xl p-16 text-center border border-slate-100">
                <p className="text-lg font-bold text-slate-700 mb-2">
                  Impossible de charger le catalogue.
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Vérifiez votre connexion puis réessayez dans quelques instants.
                </p>
                <Button onClick={fetchProducts} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Réessayer
                </Button>
              </div>
            ) : visibleModels.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center border border-slate-100">
                <p className="text-lg font-bold text-slate-500 mb-2">Aucun modèle ne correspond à vos critères.</p>
                <button onClick={resetFilters} className="text-sm font-bold text-[#3b82f6] hover:underline">
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {visibleModels.map((m, index) => {
                    // Accessoire : prix simple (pas de « à partir de »). Prix 0 =
                    // câble « à définir » → « Bientôt disponible » (non achetable).
                    const comingSoon = isAccessories && m.minPrice <= 0;
                    const priceLabel = comingSoon
                      ? 'Bientôt'
                      : isAccessories
                        ? `${m.minPrice.toFixed(0)} €`
                        : m.minPrice === m.maxPrice
                          ? `${m.minPrice.toFixed(0)} €`
                          : `À partir de ${m.minPrice.toFixed(0)} €`;
                    // Toutes les cartes sont cliquables (sell-to-order).
                    const CardWrapper = ({ children }: { children: React.ReactNode }) => (
                      <Link href={`/products/${m.firstAvailableSkuId}`} prefetch className="block h-full">{children}</Link>
                    );

                    return (
                      <motion.div
                        key={m.slug}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.4) }}
                        className="h-full"
                      >
                        <CardWrapper>
                          {/* Carte transparente : le téléphone détouré (PNG) repose
                              directement sur le fond crème de la page, comme sur la
                              fiche — pas de carré blanc. Surface blanche au survol. */}
                          <div className="rounded-[32px] p-6 flex flex-col group h-full relative transition-all duration-500 hover:bg-white hover:shadow-2xl hover:-translate-y-2">
                            <div className="block relative h-64 mb-6 flex items-center justify-center p-4">
                              <img
                                src={isAccessories
                                  ? resolveProductImage({ brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] })
                                  : resolveModelCardImage(
                                      { brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] },
                                      m.representativeColor,
                                    )}
                                alt={`${m.brand} ${m.model}`}
                                onError={onImageErrorToPlaceholder(`${m.brand} ${m.model}`)}
                                loading="lazy"
                                decoding="async"
                                className="max-h-full w-auto object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
                              />
                            </div>

                            <div className="flex flex-col flex-grow">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.brand}</span>
                              <h3 className="text-lg font-black text-[#0A0F1E] leading-tight mb-2 group-hover:text-[#3b82f6] transition-colors">
                                {m.model}
                              </h3>

                              {/* Téléphone : plusieurs configurations. Accessoire :
                                  produit simple, on n'annonce rien de technique. */}
                              <p className="text-xs font-bold text-slate-500 mb-6">
                                {isAccessories ? 'Disponible à la commande' : 'Plusieurs configurations au choix'}
                              </p>

                              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex flex-col">
                                  {!comingSoon && m.minPriceCompareAt && (
                                    <span className="text-xs font-bold text-slate-400 line-through tracking-tight">
                                      {m.minPriceCompareAt.toFixed(0)} €
                                    </span>
                                  )}
                                  <span className="text-2xl font-black text-[#0A0F1E] tracking-tighter">{priceLabel}</span>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-[#3b82f6] flex items-center justify-center text-white flex-shrink-0 shadow-lg transition-transform group-hover:scale-105">
                                  <ArrowRight className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardWrapper>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {isMobileFiltersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileFiltersOpen(false)}
              className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filtres du catalogue"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[300px] bg-white z-[101] lg:hidden p-8 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-[#0A0F1E]">Filtres</h2>
                <button onClick={() => setIsMobileFiltersOpen(false)} aria-label="Fermer les filtres" className="p-2 bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-[#0A0F1E]" />
                </button>
              </div>

              {!isAccessories && (
              <div className="mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Marque</h3>
                <div className="space-y-3">
                  {visibleBrands.map((brand) => (
                    <label key={brand} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={brandFilter.includes(brand)}
                        onChange={() => toggleFilter(brandFilter, setBrandFilter, brand)}
                      />
                      <div className="w-5 h-5 rounded-md border-2 border-slate-200 peer-checked:bg-[#3b82f6] peer-checked:border-[#3b82f6] transition-all" />
                      <span className="text-sm font-bold text-slate-600 peer-checked:text-[#0A0F1E] transition-colors">
                        {brand} <span className="font-medium text-slate-400">({brandCounts.get(brand) || 0})</span>
                      </span>
                    </label>
                  ))}
                </div>
                {allBrands.length > BRANDS_COLLAPSED && (
                  <button
                    onClick={() => setShowAllBrands((v) => !v)}
                    className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#3b82f6]"
                  >
                    {showAllBrands ? (
                      <><Minus className="w-3.5 h-3.5" /> Voir moins</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5" /> Voir plus ({allBrands.length - BRANDS_COLLAPSED})</>
                    )}
                  </button>
                )}
              </div>
              )}

              <div className="mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Prix max : {effectiveMax}€</h3>
                <input
                  type="range"
                  min="0"
                  max={priceCeiling}
                  step="50"
                  value={effectiveMax}
                  onChange={(e) => setPriceMax(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                />
              </div>

              {/* Stockage + Grade masqués pour les accessoires (produits simples). */}
              {!isAccessories && (
                <>
                  <div className="mb-8">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Stockage</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {storages.map((storage) => (
                        <button
                          key={storage}
                          onClick={() => toggleFilter(storageFilter, setStorageFilter, storage)}
                          className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all ${storageFilter.includes(storage) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-100 text-slate-400'}`}
                        >
                          {storage} Go
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Grade</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {grades.map((grade) => (
                        <button
                          key={grade}
                          onClick={() => toggleFilter(gradeFilter, setGradeFilter, grade)}
                          title={displayGradeLabelFr(grade)}
                          className={`py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all ${gradeFilter.includes(grade) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-100 text-slate-400'}`}
                        >
                          Grade {grade}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="mt-12 space-y-4">
                <Button onClick={() => setIsMobileFiltersOpen(false)} className="w-full bg-[#0A0F1E] text-white py-4 rounded-xl font-bold">
                  Appliquer les filtres
                </Button>
                <button onClick={resetFilters} className="w-full py-2 text-sm font-bold text-slate-400 hover:text-[#0A0F1E] transition-colors">
                  Tout réinitialiser
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Wrapper exporté : Suspense requis par useSearchParams sur une page client.
// La page serveur (page.tsx) porte les metadata SEO.
export default function CatalogClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CatalogContent />
    </Suspense>
  );
}
