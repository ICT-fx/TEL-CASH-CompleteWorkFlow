'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown, Check, RotateCcw, Sparkles, Loader2, ArrowRight, Search, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { groupSkusByModel, type RawProduct } from '@/lib/productVariants';
import { normalizeGradeLetter, gradeLabelFr, GRADE_ORDER } from '@/lib/products';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Catalogue téléphones uniquement — les accessoires ont leur page dédiée.
        // fields=card : on ne rapatrie que les colonnes utiles aux cartes.
        const res = await fetch('/api/products?category=telephones&limit=all&fields=card');
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Initial brand filter from URL (?brand=apple|android)
  const initialBrand = searchParams.get('brand');
  const initialBrands = useMemo(() => {
    if (initialBrand === 'apple') return ['Apple'];
    if (initialBrand === 'android') return ['Samsung', 'Xiaomi', 'Google'];
    return [];
  }, [initialBrand]);

  const [brandFilter, setBrandFilter] = useState<string[]>(initialBrands);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [storageFilter, setStorageFilter] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1500]);
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'name'>('popular');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);

  useEffect(() => {
    if (initialBrand) setBrandFilter(initialBrands);
  }, [initialBrands, initialBrand]);

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

  // Nombre de produits actifs par marque — affiché à côté de chaque marque.
  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const b = p.brand?.trim();
      if (p.is_active && b) m.set(b, (m.get(b) || 0) + 1);
    }
    return m;
  }, [products]);

  const BRANDS_COLLAPSED = 4;
  const visibleBrands = showAllBrands ? allBrands : allBrands.slice(0, BRANDS_COLLAPSED);
  // D et E (mauvais états) ne sont jamais publiés → exclus du filtre client.
  const grades = GRADE_ORDER.filter((g) => g !== 'D' && g !== 'E');
  const storages = ['64', '128', '256', '512'];

  // 1) Filter SKUs FIRST (so model cards adapt to the active filters).
  // 2) Group the filtered SKUs by (brand, model) — models with no matching SKU
  //    automatically drop out (EXISTS semantics).
  const visibleModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filteredSkus = products.filter((p) => {
      if (!p.is_active) return false;
      if (q && !`${p.brand || ''} ${p.model || ''}`.toLowerCase().includes(q)) return false;
      if (brandFilter.length > 0 && !brandFilter.includes(p.brand || '')) return false;
      if (gradeFilter.length > 0) {
        const letter = normalizeGradeLetter(p.grade);
        if (!letter || !gradeFilter.includes(letter)) return false;
      }
      if (storageFilter.length > 0) {
        const sc = (p.storage_capacity || '').toString();
        if (!storageFilter.some((s) => sc.includes(s))) return false;
      }
      const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
      if (!Number.isFinite(price as number)) return false;
      if ((price as number) < priceRange[0] || (price as number) > priceRange[1]) return false;
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
  }, [products, searchQuery, brandFilter, gradeFilter, storageFilter, priceRange, sortBy]);

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const resetFilters = () => {
    setBrandFilter([]);
    setGradeFilter([]);
    setStorageFilter([]);
    setPriceRange([0, 1500]);
    setSearchQuery('');
    router.push('/products', { scroll: false });
  };

  const activeFilterCount =
    brandFilter.length + gradeFilter.length + storageFilter.length +
    (priceRange[0] > 0 || priceRange[1] < 1500 ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
      <section className="bg-white border-b border-slate-100 pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
                le meilleur du reconditionné
              </span>
              <Sparkles className="w-5 h-5 text-yellow-400 opacity-60 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-[#0A0F1E] mb-4">
              Nos Smartphones
            </h1>
            <p className="text-lg text-slate-500 max-w-2xl font-medium">
              Découvrez notre sélection de smartphones expertisés et garantis 24 mois.
            </p>

            {/* Barre de recherche produit */}
            <div className="w-full max-w-2xl mt-8">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit (ex. iPhone 13, Galaxy S22...)"
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

              <div className="mb-8">
                <h3 className="text-sm font-black text-[#0A0F1E] uppercase tracking-widest mb-4">Prix max : {priceRange[1]}€</h3>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                />
              </div>

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
                <div className="grid grid-cols-3 gap-2">
                  {grades.map((grade) => (
                    <button
                      key={grade}
                      onClick={() => toggleFilter(gradeFilter, setGradeFilter, grade)}
                      title={gradeLabelFr(grade)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${gradeFilter.includes(grade) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-50 text-slate-400 hover:border-slate-200'}`}
                    >
                      Grade {grade}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-grow">
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm font-bold text-slate-400">
                {visibleModels.length} modèle{visibleModels.length > 1 ? 's' : ''} trouvé{visibleModels.length > 1 ? 's' : ''}
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
                    const priceLabel = m.minPrice === m.maxPrice
                      ? `${m.minPrice.toFixed(0)} €`
                      : `À partir de ${m.minPrice.toFixed(0)} €`;
                    const stockBadge =
                      m.totalStock === 0
                        ? { label: 'Indisponible', bg: '#e2e8f0', color: '#475569' }
                        : m.totalStock <= 3
                          ? { label: 'Stock limité', bg: '#fee2e2', color: '#991b1b' }
                          : { label: 'En stock', bg: '#dcfce7', color: '#166534' };

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
                        <Link href={`/products/${m.firstAvailableSkuId}`} className="block h-full">
                          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col group h-full relative">
                            <div className="absolute top-4 right-4 z-10">
                              <span
                                className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest"
                                style={{ background: stockBadge.bg, color: stockBadge.color }}
                              >
                                {stockBadge.label}
                              </span>
                            </div>

                            <div className="block relative h-64 mb-6 flex items-center justify-center p-4">
                              <div className="absolute inset-0 bg-blue-50/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                              <img
                                src={resolveProductImage({ brand: m.brand, model: m.model, images: m.representativeImage ? [m.representativeImage] : [] })}
                                alt={`${m.brand} ${m.model}`}
                                onError={onImageErrorToPlaceholder(`${m.brand} ${m.model}`)}
                                className="max-h-full w-auto object-contain rounded-2xl drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
                              />
                            </div>

                            <div className="flex flex-col flex-grow">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.brand}</span>
                              <h3 className="text-lg font-black text-[#0A0F1E] leading-tight mb-2 group-hover:text-[#3b82f6] transition-colors">
                                {m.model}
                              </h3>

                              {/* Pas de jargon technique côté client : on annonce
                                  simplement qu'il y a plusieurs configurations. */}
                              <p className="text-xs font-bold text-slate-500 mb-6">
                                Plusieurs configurations au choix
                              </p>

                              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-2xl font-black text-[#0A0F1E] tracking-tighter">{priceLabel}</span>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-[#3b82f6] flex items-center justify-center text-white flex-shrink-0 shadow-lg transition-transform group-hover:scale-105">
                                  <ArrowRight className="w-5 h-5" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
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
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[300px] bg-white z-[101] lg:hidden p-8 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-[#0A0F1E]">Filtres</h2>
                <button onClick={() => setIsMobileFiltersOpen(false)} className="p-2 bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-[#0A0F1E]" />
                </button>
              </div>

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

              <div className="mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Prix max : {priceRange[1]}€</h3>
                <input
                  type="range"
                  min="0"
                  max="1500"
                  step="50"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                />
              </div>

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

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F9F8F5] flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CatalogContent />
    </Suspense>
  );
}
