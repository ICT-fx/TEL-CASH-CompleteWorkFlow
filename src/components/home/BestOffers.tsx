'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, ShoppingCart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/store/useCart';
import { displayGrade, displayGradeLabelFr } from '@/lib/products';
import { normalizeStorage } from '@/lib/productVariants';
import { colorLabelFr } from '@/lib/colors';
import { resolveProductImage, onImageErrorToPlaceholder } from '@/lib/productImage';

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

const tabs = ["Bons plans", "Meilleures ventes", "Nouveautés", "Petit budget"];

export function BestOffers() {
  const [activeTab, setActiveTab] = useState("Meilleures ventes");
  const [products, setProducts] = useState<Record<string, ApiProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { addItem, openCart } = useCart();

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const fetchAllProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/products?limit=all&fields=card');
        if (res.ok) {
          const data = await res.json();
          const allProducts = data.products || [];

          // VITRINE : uniquement des produits avec une VRAIE photo (jamais de
          // placeholder). En pratique seuls les iPhone ont des packshots, donc on
          // se limite aux iPhone (les accessoires ont leur propre vitrine).
          // Une carte = un modèle, représenté par la variante la moins chère DONT
          // la couleur a une vraie photo → le visuel de la carte est toujours réel.
          const hasRealPhoto = (p: any) =>
            !resolveProductImage(
              { brand: p.brand, model: p.model, images: p.images },
              p.color,
              { strict: true },
            ).startsWith('data:');

          const iphones = allProducts.filter(
            (p: any) => p.category !== 'accessoires' && /iphone/i.test(p.model || '') && hasRealPhoto(p),
          );
          const byModel = new Map<string, ApiProduct>();
          for (const p of iphones) {
            const key = (p.model || '').trim();
            if (!key) continue;
            const ex = byModel.get(key);
            if (!ex || parseFloat(p.price) < parseFloat(ex.price)) byModel.set(key, p);
          }
          const models = [...byModel.values()].map((p: any) => ({
            ...p,
            original_price: p.compare_at_price != null ? String(p.compare_at_price) : p.original_price,
          }));

          // Génération iPhone pour le tri récence / petit budget (SE = ancienne gamme).
          const genNum = (m: any) => {
            const x = (m.model || '').match(/iphone\s+(\d+)/i);
            if (x) return parseInt(x[1], 10);
            if (/iphone se/i.test(m.model || '')) return 10;
            return 0;
          };
          const priceOf = (m: any) => parseFloat(m.price) || Infinity;
          const stockOf = (m: any) => Number(m.stock) || 0;
          const isPromo = (m: any) => m.original_price && parseFloat(m.original_price) > parseFloat(m.price);
          const discount = (m: any) => (isPromo(m) ? parseFloat(m.original_price) - parseFloat(m.price) : 0);

          // Bons plans : vraies réductions d'abord (remise décroissante), puis le
          // meilleur RAPPORT QUALITÉ-PRIX = modèles récents (gén. ≥ 13) au prix le
          // plus bas. Distinct de « Petit budget » (vieux modèles les moins chers).
          const promos = models.filter(isPromo).sort((a, b) => discount(b) - discount(a));
          const haveIds = new Set(promos.map((p: any) => p.id));
          const byCheap = [...models].sort((a, b) => priceOf(a) - priceOf(b));
          const goodValue = models
            .filter((m: any) => genNum(m) >= 13 && !haveIds.has(m.id))
            .sort((a, b) => priceOf(a) - priceOf(b));
          const bonsPlans = [...promos, ...goodValue].slice(0, 8);

          // Meilleures ventes : modèles phares = plus gros stock écoulé (proxy).
          const meilleuresVentes = [...models].sort((a, b) => stockOf(b) - stockOf(a)).slice(0, 8);

          // Nouveautés : modèles les plus récents (génération décroissante).
          const nouveautes = [...models]
            .sort((a, b) => genNum(b) - genNum(a) || stockOf(b) - stockOf(a))
            .slice(0, 8);

          // Petit budget : les moins chers, sans les gros iPhone récents (15/16/17).
          const petitBudget = byCheap.filter((m: any) => genNum(m) < 15).slice(0, 8);

          setProducts({
            "Bons plans": bonsPlans,
            "Meilleures ventes": meilleuresVentes,
            "Nouveautés": nouveautes,
            "Petit budget": petitBudget,
          });
        }
      } catch (err) {
        console.error('Error fetching best offers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllProducts();
  }, []);

  // Panier invité disponible : plus de redirection forcée vers le login.
  const handleAddToCart = async (e: React.MouseEvent, product: ApiProduct) => {
    e.preventDefault();
    e.stopPropagation();
    await addItem(product);
  };

  const startDragging = (e: React.MouseEvent) => {
    setIsDragging(true);
    if (!scrollContainerRef.current) return;
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const stopDragging = () => { setIsDragging(false); };

  const onDrag = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const { clientWidth } = scrollContainerRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth / 1.5 : clientWidth / 1.5;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const currentProducts = products[activeTab] || [];

  return (
    <section className="py-24 bg-[#F9F8F5] overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">

        {/* Header: title left, annotation floating right */}
        <div className="mb-10 relative">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Title block */}
            <div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0A0F1E] relative inline-block">
                Recommandés pour vous
                <svg width="22" height="22" viewBox="0 0 24 24" className="absolute -top-4 -right-8 stroke-yellow-400 fill-none stroke-[1.5px] opacity-90 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" className="absolute -bottom-2 -left-5 stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-60 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
              </h2>
            </div>

            <div className="relative flex-col items-end md:items-end mt-1 md:mt-0 hidden md:flex">
              <span className="text-[#3b82f6] font-caveat text-2xl -rotate-2 inline-block">
                sélectionné pour vous
              </span>
              <svg width="50" height="36" viewBox="0 0 50 36" className="fill-none mt-2" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M 42 4 C 30 4 10 10 6 28" stroke="#3b82f6" strokeWidth="1.5"/>
                <path d="M 6 28 L 2 20 M 6 28 L 14 24" stroke="#3b82f6" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Tabs + Nav */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 relative overflow-hidden ${
                  activeTab === tab
                    ? "bg-[#3b82f6] border border-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                    : "bg-transparent border border-[#0A0F1E]/20 text-[#0A0F1E]/70 hover:border-[#3b82f6]/50 hover:text-[#3b82f6]"
                }`}
              >
                {activeTab === tab && (
                  <span className="absolute inset-0 bg-white/20 blur-md rounded-full" />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>

          <div className="hidden md:flex gap-3 relative z-20">
            <button
              onClick={() => scroll('left')}
              className="w-12 h-12 rounded-full border border-[#0A0F1E]/20 flex items-center justify-center text-[#0A0F1E]/60 hover:bg-[#3b82f6] hover:text-white hover:border-[#3b82f6] transition-all bg-white shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-12 h-12 rounded-full border border-[#0A0F1E]/20 flex items-center justify-center text-[#0A0F1E]/60 hover:bg-[#3b82f6] hover:text-white hover:border-[#3b82f6] transition-all bg-white shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div 
          className="relative -mx-4 px-4 md:mx-0 md:px-0 min-h-[350px]"
          style={{
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin" />
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              onMouseDown={startDragging}
              onMouseLeave={stopDragging}
              onMouseUp={stopDragging}
              onMouseMove={onDrag}
              className={`flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-10 pt-2 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none' 
              }}
            >
              <AnimatePresence mode="wait">
                {currentProducts.length > 0 ? (
                  currentProducts.map((product, index) => {
                    const price = parseFloat(product.price);
                    const originalPrice = product.original_price ? parseFloat(product.original_price) : null;
                    const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
                    const gradeLetter = displayGrade(product.grade);
                    const dynamicRating = gradeLetter === 'A' ? 5 : gradeLetter === 'B' ? 4.5 : 4;
                    const dynamicReviews = 42 + index * 7;
                    const isPromo = discount > 0;
                    
                    return (
                      <motion.div
                        key={`${activeTab}-${product.id}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex-none w-[240px] snap-start"
                      >
                        <div className="h-full border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.1)] transition-shadow rounded-3xl flex flex-col relative bg-white overflow-hidden group hover:shadow-md transition-all">
                          
                          {isPromo && (
                            <div className="absolute top-4 left-4 z-10">
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide uppercase bg-rose-100 text-rose-700">
                                Promo -{discount}%
                              </span>
                            </div>
                          )}
                          
                          <Link href={`/products/${product.id}`} className="block relative h-[220px] w-full p-6 pt-12 flex items-center justify-center bg-slate-50/50 group-hover:bg-slate-50 transition-colors">
                            <img
                              src={resolveProductImage({ brand: product.brand, model: product.model, images: product.images }, product.color, { strict: true })}
                              alt={`${product.brand} ${product.model}`}
                              onError={onImageErrorToPlaceholder(`${product.brand} ${product.model}`)}
                              loading="lazy"
                              decoding="async"
                              className="w-auto h-[140px] object-contain drop-shadow-md mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
                            />
                          </Link>

                          <div className="p-5 flex flex-col flex-grow">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1">{product.brand}</span>
                            <Link href={`/products/${product.id}`} className="block w-fit">
                              <h3 className="font-bold text-[#0A0F1E] text-base leading-tight mb-1.5 group-hover:text-[#3b82f6] transition-colors">
                                {product.model}
                              </h3>
                            </Link>
                            
                            <p className="text-[13px] text-slate-500 font-medium mb-3 leading-tight pr-2">
                              {[normalizeStorage(product.storage_capacity), colorLabelFr(product.color), gradeLetter ? displayGradeLabelFr(gradeLetter) : null].filter(Boolean).join(' · ')}
                            </p>

                            <div className="flex items-center gap-1.5 mb-5 text-[#FFB800]">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3.5 h-3.5 ${i < dynamicRating ? 'fill-current' : 'text-slate-200 fill-slate-200'}`} />
                              ))}
                              <span className="text-[11px] font-medium text-slate-400">({dynamicReviews})</span>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                              <div className="flex flex-col items-start leading-none">
                                {originalPrice && (
                                  <span className="text-[11px] text-slate-400 font-bold line-through mb-1">
                                    {originalPrice.toFixed(2).replace('.', ',')} €
                                  </span>
                                )}
                                <span className="text-[22px] font-black text-[#0A0F1E] tracking-tight">
                                  {price.toFixed(2).replace('.', ',')} €
                                </span>
                              </div>
                              
                              <button 
                                onClick={(e) => handleAddToCart(e, product)}
                                className="w-10 h-10 rounded-full bg-[#2563EB] hover:bg-blue-700 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-blue-500/30 transition-transform active:scale-95 group/btn"
                              >
                                <ShoppingCart className="w-4 h-4 group-hover/btn:-rotate-12 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="w-full text-center py-20 text-slate-400">
                    Aucun produit disponible dans cette catégorie.
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
