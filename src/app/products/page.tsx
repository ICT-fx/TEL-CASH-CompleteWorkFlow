'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShoppingCart, SlidersHorizontal, X, ChevronDown, Check, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/contexts/AuthContext';

interface ApiProduct {
  id: string;
  brand: string;
  model: string;
  storage_capacity: string;
  grade: string;
  color: string;
  price: string;
  original_price?: string;
  battery_health?: string;
  images: string[];
  stock: number;
  is_active: boolean;
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { user } = useAuth();
  const { addItem, openCart } = useCart();
  
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
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

  const handleAddToCart = async (e: React.MouseEvent, product: ApiProduct) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = '/auth/login';
      return;
    }

    await addItem(product);
  };
  
  // Initial brand filter from URL
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
  const [sortBy, setSortBy] = useState('popular');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Sync brand filter if URL changes
  useEffect(() => {
    if (initialBrand) {
      setBrandFilter(initialBrands);
    }
  }, [initialBrands, initialBrand]);

  const brands = ['Apple', 'Samsung', 'Xiaomi', 'Google'];
  const grades = ['Parfait État', 'Très Bon État', 'État Correct'];
  const storages = ['64', '128', '256', '512'];

  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    if (brandFilter.length > 0) {
      result = result.filter(p => brandFilter.includes(p.brand));
    }
    if (gradeFilter.length > 0) {
      result = result.filter(p => gradeFilter.includes(p.grade));
    }
    if (storageFilter.length > 0) {
      // The API returns strings like "128 Go", we filter by "128"
      result = result.filter(p => storageFilter.some(s => p.storage_capacity?.includes(s)));
    }
    
    result = result.filter(p => parseFloat(p.price) >= priceRange[0] && parseFloat(p.price) <= priceRange[1]);

    switch (sortBy) {
      case 'price-asc': result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)); break;
      case 'price-desc': result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); break;
      case 'name': result.sort((a, b) => a.model.localeCompare(b.model)); break;
    }
    return result;
  }, [products, brandFilter, gradeFilter, storageFilter, priceRange, sortBy]);

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  const resetFilters = () => {
    setBrandFilter([]);
    setGradeFilter([]);
    setStorageFilter([]);
    setPriceRange([0, 1500]);
    router.push('/products', { scroll: false });
  };

  const activeFilterCount = brandFilter.length + gradeFilter.length + storageFilter.length + (priceRange[0] > 0 || priceRange[1] < 1500 ? 1 : 0);

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
                  {brands.map(brand => (
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
                      <span className="text-sm font-bold text-slate-600 group-hover:text-[#0A0F1E] transition-colors">{brand}</span>
                    </label>
                  ))}
                </div>
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
                  {storages.map(storage => (
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
                  {grades.map(grade => (
                    <button 
                      key={grade} 
                      onClick={() => toggleFilter(gradeFilter, setGradeFilter, grade)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${gradeFilter.includes(grade) ? 'border-[#3b82f6] bg-blue-50 text-[#3b82f6]' : 'border-slate-50 text-slate-400 hover:border-slate-200'}`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-grow">
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm font-bold text-slate-400">
                {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
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
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-white border border-slate-100 rounded-full px-6 py-2.5 pr-10 text-sm font-bold text-[#0A0F1E] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                  >
                    <option value="popular">Trier par : Populaire</option>
                    <option value="price-asc">Prix croissant</option>
                    <option value="price-desc">Prix décroissant</option>
                    <option value="name">Nom A-Z</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product, index) => {
                    const price = parseFloat(product.price);
                    const originalPrice = product.original_price ? parseFloat(product.original_price) : null;
                    const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
                    const dynamicRating = product.grade === 'Parfait État' ? 5 : product.grade === 'Très Bon État' ? 4.5 : 4;
                    
                    return (
                      <motion.div
                        key={product.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="h-full"
                      >
                        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col group h-full">
                          {discount > 0 && (
                            <div className="absolute top-4 left-4 z-10">
                              <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                Offre Spéciale -{discount}%
                              </span>
                            </div>
                          )}
                          
                          <Link href={`/products/${product.id}`} className="block relative h-64 mb-6 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-blue-50/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img 
                              src={product.images?.[0] || '/products/iphone-13-pro-blue.png'} 
                              alt={`${product.brand} ${product.model}`} 
                              className="max-h-full w-auto object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" 
                            />
                          </Link>

                          <div className="flex flex-col flex-grow">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{product.brand}</span>
                            <Link href={`/products/${product.id}`} className="hover:text-[#3b82f6] transition-colors mb-2">
                              <h3 className="text-lg font-black text-[#0A0F1E] leading-tight">{product.model}</h3>
                            </Link>
                            
                            <div className="flex items-center gap-1 mb-4">
                              <div className="flex gap-0.5 text-[#FFB800]">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i < dynamicRating ? 'fill-current' : 'text-slate-200 fill-slate-200'}`} />
                                ))}
                              </div>
                            </div>

                            <p className="text-xs font-bold text-slate-500 mb-6 flex items-center gap-2">
                               {product.storage_capacity} • {product.color} • {product.grade}
                            </p>

                            <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                              <div className="flex flex-col">
                                {originalPrice && (
                                  <span className="text-[10px] font-bold text-slate-400 line-through mb-0.5">{originalPrice.toFixed(0)}€</span>
                                )}
                                <span className="text-2xl font-black text-[#0A0F1E] tracking-tighter">{price.toFixed(0)}€</span>
                              </div>
                              
                              <button 
                                onClick={(e) => handleAddToCart(e, product)}
                                className="w-12 h-12 rounded-2xl bg-[#00b06b] hover:bg-[#00965a] flex items-center justify-center text-white flex-shrink-0 shadow-lg transition-transform hover:scale-105 active:scale-95 group/btn"
                              >
                                <ShoppingCart className="w-5 h-5 transition-transform group-hover/btn:-rotate-12" />
                              </button>
                            </div>
                          </div>
                        </div>
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
                  {brands.map(brand => (
                    <label key={brand} className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="peer sr-only" 
                        checked={brandFilter.includes(brand)}
                        onChange={() => toggleFilter(brandFilter, setBrandFilter, brand)}
                      />
                      <div className="w-5 h-5 rounded-md border-2 border-slate-200 peer-checked:bg-[#3b82f6] peer-checked:border-[#3b82f6] transition-all" />
                      <span className="text-sm font-bold text-slate-600 peer-checked:text-[#0A0F1E] transition-colors">{brand}</span>
                    </label>
                  ))}
                </div>
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
