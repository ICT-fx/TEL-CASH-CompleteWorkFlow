'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown, Check, RotateCcw, Loader2, Search, Plus, Minus, Store } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { groupSkusByModel, type RawProduct } from '@/lib/productVariants';
import { productUrl } from '@/lib/productUrl';
import { displayGrade, displayGradeLabelFr, DISPLAY_GRADE_ORDER } from '@/lib/products';
import { resolveProductImage, resolveModelCardImage, onImageErrorToPlaceholder } from '@/lib/productImage';
import { PICKUP_STORE_ADDRESS_LINE1 } from '@/lib/shipping';

// Pagination « Voir plus » : nombre de cartes ajoutées à chaque clic (pair →
// grille 2 colonnes mobile pleine ; multiple de 3 → grille 3 colonnes ordinateur).
const PAGE_SIZE = 12;
// Puce « Moins de 300 € » : plafond appliqué au filtre prix existant.
const BUDGET_CHIP_MAX = 300;

// Normalise une chaîne pour une recherche tolérante : minuscules, sans accents
// et sans espaces/ponctuation. Ainsi « Galaxy S22 », « galaxys22 » et
// « galaxy  s22 » deviennent tous « galaxys22 ».
function normalizeSearch(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9]/g, ''); // retire espaces, tirets, ponctuation…
}

// Vrai si chaque mot saisi (normalisé) se retrouve dans le texte cible.
// Tolère les espaces oubliés/en trop, les accents et la ponctuation.
function matchesSearch(haystack: string, query: string): boolean {
  const target = normalizeSearch(haystack);
  const tokens = query.split(/\s+/).map(normalizeSearch).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => target.includes(t));
}

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

  // Recherche GLOBALE (depuis le header, hors page accessoires) : on couvre
  // téléphones ET accessoires en omettant le filtre catégorie. Booléen STABLE
  // (ne dépend pas des autres filtres) → le catalogue n'est re-fetché que quand
  // la catégorie ou le mode recherche change, jamais à chaque réglage de filtre.
  const crossCategory = (searchParams.get('q') || '').trim().length > 0 && !isAccessories;
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const url = crossCategory
        ? `/api/products?limit=all&fields=card`
        : `/api/products?category=${categoryParam}&limit=all&fields=card`;
      // fields=card : on ne rapatrie que les colonnes utiles aux cartes.
      const res = await fetch(url);
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
  }, [categoryParam, crossCategory]);

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
  // Anciens liens ?sort=promo (tri par remise) : sans prix barré affiché, la
  // « promo » n'a plus de sens → on la mappe sur le prix croissant (les
  // meilleures affaires d'abord). Toute autre valeur inconnue → 'popular'.
  const SORT_ALIASES: Record<string, SortKey> = { promo: 'price-asc' };
  const rawSort = searchParams.get('sort');
  const initialSort = rawSort && SORT_ALIASES[rawSort] ? SORT_ALIASES[rawSort] : rawSort;

  const [brandFilter, setBrandFilter] = useState<string[]>(
    () => (csv('brands').length > 0 ? csv('brands') : initialBrands),
  );
  const [gradeFilter, setGradeFilter] = useState<string[]>(() => csv('grades'));
  const [storageFilter, setStorageFilter] = useState<string[]>(() => csv('storages'));
  // Filtre par TYPE d'accessoire (câble, chargeur, écouteurs, batterie, protection…).
  const [typeFilter, setTypeFilter] = useState<string[]>(() => csv('types'));
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
      if (typeFilter.length > 0) params.set('types', typeFilter.join(','));
      if (priceMax != null && priceMax < priceCeiling) params.set('prix_max', String(priceMax));
      if (sortBy !== 'popular') params.set('sort', sortBy);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const qs = params.toString();
      router.replace(qs ? `/products?${qs}` : '/products', { scroll: false });
    }, 300);
    return () => {
      if (urlSyncTimer.current) window.clearTimeout(urlSyncTimer.current);
    };
  }, [isAccessories, brandFilter, gradeFilter, storageFilter, typeFilter, priceMax, priceCeiling, sortBy, searchQuery, router]);

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

  // Types d'accessoires présents en catalogue (dérivés du product_type réel),
  // avec libellé FR + compteur. Sert au filtre « Type » de la section accessoires.
  const ACCESSORY_TYPE_LABELS: Record<string, string> = {
    cable: 'Câble', chargeur: 'Chargeur', ecouteurs: 'Écouteurs',
    batterie: 'Batterie', coque: 'Coque', verre: 'Protection', protection_posee: 'Protection',
  };
  const accessoryTypes = useMemo(() => {
    if (!isAccessories) return [] as { type: string; label: string; count: number }[];
    const counts = new Map<string, number>();
    for (const p of products) {
      if (!p.is_active) continue;
      const t = (p.product_type as string) || '';
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }
    const order = ['cable', 'chargeur', 'ecouteurs', 'batterie', 'coque', 'verre', 'protection_posee'];
    return [...counts.keys()]
      .sort((a, b) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)))
      .map((t) => ({ type: t, label: ACCESSORY_TYPE_LABELS[t] || t, count: counts.get(t)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAccessories, products]);
  // Boutique : 3 grades client uniquement (A/B/C). Les sous-grades (A+, C+) et
  // les D/E sont repliés/exclus côté affichage et filtrage.
  const grades = DISPLAY_GRADE_ORDER;
  const storages = ['64', '128', '256', '512'];

  // 1) Filter SKUs FIRST (so model cards adapt to the active filters).
  // 2) Group the filtered SKUs by (brand, model) — models with no matching SKU
  //    automatically drop out (EXISTS semantics).
  const visibleModels = useMemo(() => {
    const q = searchQuery.trim();
    const filteredSkus = products.filter((p) => {
      if (!p.is_active) return false;
      if (q && !matchesSearch(`${p.brand || ''} ${p.model || ''}`, q)) return false;
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
      // Accessoires : filtre par TYPE (câble, chargeur, batterie, protection…).
      if (isAccessories && typeFilter.length > 0) {
        if (!typeFilter.includes((p.product_type as string) || '')) return false;
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
  }, [isAccessories, products, searchQuery, brandFilter, gradeFilter, storageFilter, typeFilter, effectiveMax, sortBy]);

  // Nombre total de modèles du catalogue (non filtré) pour le sous-titre.
  const totalModels = useMemo(
    () => groupSkusByModel(products.filter((p) => p.is_active)).length,
    [products],
  );

  // Pagination « Voir plus » : repart de PAGE_SIZE à chaque changement de filtre/tri.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [isAccessories, brandFilter, gradeFilter, storageFilter, typeFilter, priceMax, sortBy, searchQuery]);
  const pagedModels = visibleModels.slice(0, visibleCount);

  // Puces de filtre rapide (maquette Catalogue-mobile). Elles pilotent les
  // MÊMES états que le panneau Filtres (marque / type / prix max) : pas de
  // logique de filtrage parallèle.
  const chips = useMemo(() => {
    const out: { key: string; label: string; active: boolean; onClick: () => void }[] = [];
    if (isAccessories) {
      out.push({ key: 'all', label: 'Tous', active: typeFilter.length === 0, onClick: () => setTypeFilter([]) });
      for (const t of accessoryTypes) {
        const on = typeFilter.length === 1 && typeFilter[0] === t.type;
        out.push({ key: `type-${t.type}`, label: t.label, active: on, onClick: () => setTypeFilter(on ? [] : [t.type]) });
      }
      return out;
    }
    const BRAND_CHIP_LABEL: Record<string, string> = { Apple: 'iPhone', Google: 'Google Pixel' };
    const brandChip = (b: string) => {
      const on = brandFilter.length === 1 && brandFilter[0] === b;
      return { key: `brand-${b}`, label: BRAND_CHIP_LABEL[b] || b, active: on, onClick: () => setBrandFilter(on ? [] : [b]) };
    };
    const budgetOn = priceMax === BUDGET_CHIP_MAX;
    out.push({
      key: 'all',
      label: 'Tous',
      active: brandFilter.length === 0 && priceMax == null,
      onClick: () => { setBrandFilter([]); setPriceMax(null); },
    });
    // Ordre maquette : iPhone, Samsung, Moins de 300 €, puis les autres marques.
    const first = ['Apple', 'Samsung'].filter((b) => allBrands.includes(b));
    first.forEach((b) => out.push(brandChip(b)));
    out.push({
      key: 'budget',
      label: `Moins de ${BUDGET_CHIP_MAX} €`,
      active: budgetOn,
      onClick: () => setPriceMax(budgetOn ? null : BUDGET_CHIP_MAX),
    });
    allBrands.filter((b) => !first.includes(b)).forEach((b) => out.push(brandChip(b)));
    return out;
  }, [isAccessories, accessoryTypes, typeFilter, brandFilter, priceMax, allBrands]);

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const resetFilters = () => {
    setBrandFilter([]);
    setGradeFilter([]);
    setStorageFilter([]);
    setTypeFilter([]);
    setPriceMax(null);
    setSearchQuery('');
    router.push(isAccessories ? '/products?category=accessoires' : '/products', { scroll: false });
  };

  const activeFilterCount =
    brandFilter.length + gradeFilter.length + storageFilter.length + typeFilter.length +
    (priceMax != null && priceMax < priceCeiling ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
      <section className="bg-white border-b border-[#E4E8F0]">
        <div className="container mx-auto px-4 md:px-6 max-w-[1180px] pt-5 pb-3.5 md:pt-10 md:pb-8 flex flex-col gap-3.5 md:gap-5">
          <div>
            <h1 className="m-0 text-[24px] md:text-[40px] font-extrabold tracking-[-0.02em] text-[#0A0F1E]">
              {isAccessories ? 'Accessoires' : 'Smartphones reconditionnés'}
            </h1>
            <p className="mt-1 text-[14px] md:text-[16px] font-semibold text-[#5B6478]">
              {isAccessories
                ? 'Chargeurs, batteries, écouteurs et câbles · retrait gratuit à Angers'
                : `${totalModels > 0 ? `${totalModels} modèles · ` : ''}garantis 24 mois · retrait gratuit à Angers`}
            </p>
          </div>

          {/* Barre de recherche produit */}
          <label className="relative flex items-center gap-2.5 h-12 md:h-14 px-3.5 rounded-[14px] bg-[#F9F8F5] border border-[#E4E8F0] text-[#5B6478] focus-within:border-[#2457E6] focus-within:ring-4 focus-within:ring-[#2457E6]/10 md:max-w-2xl">
            <Search className="w-5 h-5 flex-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={isAccessories ? 'Rechercher un accessoire' : 'Rechercher un modèle'}
              placeholder={isAccessories ? 'Rechercher un accessoire (chargeur, batterie…)' : 'Rechercher un modèle (ex. iPhone 13)'}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-[#0A0F1E] placeholder:text-[#5B6478] [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Effacer la recherche"
                className="flex-none w-11 h-11 -mr-2.5 flex items-center justify-center rounded-full text-[#5B6478] hover:text-[#0A0F1E]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
        </div>
      </section>

      {/* Filtres rapides (puces) */}
      <nav aria-label="Filtres rapides" className="container mx-auto max-w-[1180px] px-0 md:px-6">
        <div className="flex gap-2 overflow-x-auto px-4 md:px-0 pt-3.5 pb-1.5 md:pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              aria-pressed={c.active}
              className={`flex-none inline-flex items-center gap-1.5 h-11 px-4 rounded-full border text-[14px] font-semibold whitespace-nowrap transition-colors ${
                c.active
                  ? 'bg-[#0A0F1E] border-[#0A0F1E] text-white'
                  : 'bg-white border-[#DCE2EC] text-[#0A0F1E] hover:border-[#B7C1D3]'
              }`}
            >
              {c.label}
            </button>
          ))}
          <span className="flex-none w-2 md:hidden" aria-hidden="true" />
        </div>
      </nav>

      <div className="container mx-auto px-4 md:px-6 max-w-[1180px] pt-2 pb-10 md:pt-6 md:pb-16">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

          {/* sticky + hauteur bornée à la fenêtre (sous le header) + scroll interne :
              tous les filtres restent atteignables (jusqu'à Grade C), même quand la
              colonne est plus haute que l'écran. */}
          <aside className="hidden lg:block w-[280px] shrink-0 space-y-8 sticky top-32 h-fit max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
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

              {/* Type d'accessoire (câble, chargeur, batterie, protection…) —
                  équivalent du filtre marque pour la section accessoires. */}
              {isAccessories && accessoryTypes.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">Type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {accessoryTypes.map((t) => (
                      <button
                        key={t.type}
                        onClick={() => toggleFilter(typeFilter, setTypeFilter, t.type)}
                        className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${typeFilter.includes(t.type) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-50 text-slate-400 hover:border-slate-200'}`}
                      >
                        {t.label} ({t.count})
                      </button>
                    ))}
                  </div>
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
                    <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">État</h3>
                    {/* Libellés client (lib/grades.ts) : Parfait état / Très bon état / État correct. */}
                    <div className="grid grid-cols-1 gap-1.5">
                      {grades.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          aria-pressed={gradeFilter.includes(grade)}
                          onClick={() => toggleFilter(gradeFilter, setGradeFilter, grade)}
                          className={`min-h-[44px] px-3 rounded-xl border-2 text-[13px] font-bold text-left transition-all ${gradeFilter.includes(grade) ? 'border-[#2457E6] bg-blue-50 text-[#2457E6]' : 'border-slate-100 text-[#47506A] hover:border-slate-200'}`}
                        >
                          {displayGradeLabelFr(grade)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>

          <main className="flex-grow min-w-0">
            <div className="flex items-center justify-between gap-3 pb-3">
              {/* Tri : vrai <select> natif (accessible), habillé en lien « Trier : … » */}
              <label className="relative inline-flex items-center h-11 text-[14px] font-bold text-[#0A0F1E] cursor-pointer">
                <span className="whitespace-nowrap">Trier :</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="appearance-none bg-transparent border-0 pl-1 pr-6 h-11 font-bold text-[14px] text-[#0A0F1E] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2457E6] rounded-md"
                >
                  <option value="popular">Pertinence</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                  <option value="name">Nom A → Z</option>
                </select>
                <ChevronDown className="absolute right-0 w-[18px] h-[18px] pointer-events-none" aria-hidden="true" />
              </label>

              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-[14px] font-semibold text-[#5B6478]">
                  {visibleModels.length} {isAccessories ? 'accessoire' : 'modèle'}{visibleModels.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(true)}
                  className="lg:hidden inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[#DCE2EC] bg-white text-[14px] font-bold text-[#0A0F1E]"
                >
                  <SlidersHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
                  Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="w-10 h-10 text-[#2457E6] animate-spin" />
              </div>
            ) : fetchError ? (
              <div className="bg-white rounded-2xl p-10 md:p-16 text-center border border-[#E4E8F0]">
                <p className="text-lg font-bold text-[#0A0F1E] mb-2">
                  Impossible de charger le catalogue.
                </p>
                <p className="text-[14px] text-[#5B6478] mb-6">
                  Vérifiez votre connexion puis réessayez dans quelques instants.
                </p>
                <button type="button" onClick={fetchProducts} className="tc-btn-navy">
                  <RotateCcw className="w-4 h-4" /> Réessayer
                </button>
              </div>
            ) : visibleModels.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 md:p-16 text-center border border-[#E4E8F0]">
                <p className="text-lg font-bold text-[#47506A] mb-2">Aucun modèle ne correspond à vos critères.</p>
                <button type="button" onClick={resetFilters} className="inline-flex items-center min-h-[44px] text-[14px] font-bold text-[#2457E6] hover:text-[#163DAA]">
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <>
                <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                  {pagedModels.map((m) => {
                    // Tout produit sans prix valide (≤ 0) → « Bientôt » (jamais « 0 € »).
                    // Prix unique (accessoire) : pas de « dès ». Jamais de prix barré.
                    const isSimple = isAccessories || m.minPrice === m.maxPrice;
                    const comingSoon = m.minPrice <= 0;
                    const imgSrc = isAccessories
                      ? resolveProductImage({ brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] })
                      : resolveModelCardImage(
                          { brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] },
                          m.representativeColor,
                        );
                    return (
                      <li key={m.slug} className="min-w-0">
                        <Link
                          href={productUrl({ id: m.firstAvailableSkuId, model: m.model, storage_capacity: m.firstStorage, grade: m.firstGrade })}
                          className="group flex flex-col h-full bg-white border border-[#E4E8F0] rounded-2xl overflow-hidden text-[#0A0F1E] hover:border-[#C9D3E6] hover:shadow-[0_14px_30px_-20px_rgba(11,20,55,0.35)] transition-[border-color,box-shadow]"
                        >
                          <div className="relative h-[150px] md:h-[210px] p-3.5 flex items-center justify-center bg-[radial-gradient(90%_80%_at_50%_30%,#FFFFFF_0%,#EEF2F9_60%,#E3E9F4_100%)]">
                            <img
                              src={imgSrc}
                              alt={isAccessories ? m.model : `${m.model} reconditionné`}
                              onError={onImageErrorToPlaceholder(`${m.brand} ${m.model}`)}
                              loading="lazy"
                              decoding="async"
                              className="max-h-[122px] md:max-h-[175px] max-w-full w-auto object-contain drop-shadow-[0_10px_12px_rgba(11,20,55,0.18)] transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5 px-3 pt-3 pb-3.5 md:px-4 md:pb-4">
                            <span className="text-[13px] font-bold tracking-[0.08em] uppercase text-[#5B6478] truncate">{m.brand}</span>
                            <h2 className="m-0 text-[15px] md:text-[16px] font-bold leading-snug">{m.model}</h2>
                            <span className="mt-1.5 text-[15px] font-semibold">
                              {comingSoon ? (
                                <b className="text-[16px] font-extrabold text-[#5B6478]">Bientôt</b>
                              ) : isSimple ? (
                                <b className="text-[18px] font-extrabold">{m.minPrice.toFixed(0)} €</b>
                              ) : (
                                <>dès <b className="text-[18px] font-extrabold">{m.minPrice.toFixed(0)} €</b></>
                              )}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {/* Pagination « Voir plus » */}
                <div className="mt-6 md:mt-10 flex flex-col items-center gap-3">
                  <p className="text-[14px] font-semibold text-[#47506A]" aria-live="polite">
                    {pagedModels.length} {isAccessories ? 'accessoire' : 'modèle'}{pagedModels.length > 1 ? 's' : ''} sur {visibleModels.length}
                  </p>
                  <div className="w-40 h-1 rounded-full bg-[#E4E8F0] overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-[#2457E6]"
                      style={{ width: `${Math.round((pagedModels.length / visibleModels.length) * 100)}%` }}
                    />
                  </div>
                  {pagedModels.length < visibleModels.length && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                      className="tc-btn-outline w-full md:w-auto md:min-w-[320px] mt-1"
                    >
                      {isAccessories ? "Voir plus d'accessoires" : 'Voir plus de modèles'}
                    </button>
                  )}
                </div>

                {/* Conseil en magasin */}
                {!isAccessories && (
                  <div className="mt-8 md:mt-12 flex items-start gap-3.5 rounded-2xl bg-[#0A0F1E] text-white p-4 md:p-6">
                    <Store className="w-6 h-6 flex-none mt-0.5 text-[#8FB0FF]" aria-hidden="true" />
                    <p className="m-0 text-[14px] md:text-[15px] leading-relaxed text-white/80">
                      <b className="block text-[15px] md:text-[17px] text-white mb-0.5">Pas sûr du modèle ?</b>
                      Passez au magasin, {PICKUP_STORE_ADDRESS_LINE1}. On vous conseille et vous essayez sur place.
                    </p>
                  </div>
                )}
              </>
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

              {isAccessories && accessoryTypes.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Type</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {accessoryTypes.map((t) => (
                      <button
                        key={t.type}
                        onClick={() => toggleFilter(typeFilter, setTypeFilter, t.type)}
                        className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${typeFilter.includes(t.type) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-50 text-slate-400 hover:border-slate-200'}`}
                      >
                        {t.label} ({t.count})
                      </button>
                    ))}
                  </div>
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
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">État</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {grades.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          aria-pressed={gradeFilter.includes(grade)}
                          onClick={() => toggleFilter(gradeFilter, setGradeFilter, grade)}
                          className={`min-h-[44px] px-3 rounded-xl border-2 text-[14px] font-bold text-left transition-all ${gradeFilter.includes(grade) ? 'border-[#2457E6] bg-blue-50 text-[#2457E6]' : 'border-slate-100 text-[#47506A]'}`}
                        >
                          {displayGradeLabelFr(grade)}
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
