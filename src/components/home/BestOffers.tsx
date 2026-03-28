'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import type { Product } from '@/data/mockData';
import { mockProducts } from '@/data/mockData';
import { useCart } from '@/store/useCart';

const tabs = ["Bons plans", "Meilleures ventes", "Nouveautés", "Petit budget"];

const productsData: Record<string, Product[]> = {
  "Bons plans": mockProducts.slice(0, 6),
  "Meilleures ventes": mockProducts.slice(0, 6),
  "Nouveautés": mockProducts.slice(2, 8),
  "Petit budget": mockProducts.slice(4, 8),
};

export function BestOffers() {
  const { addItem, openCart } = useCart();
  const [activeTab, setActiveTab] = useState("Meilleures ventes");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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

  const currentProducts = productsData[activeTab] || [];

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
                {/* Tiny stars */}
                <svg width="22" height="22" viewBox="0 0 24 24" className="absolute -top-4 -right-8 stroke-yellow-400 fill-none stroke-[1.5px] opacity-90 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
                <svg width="14" height="14" viewBox="0 0 24 24" className="absolute -bottom-2 -left-5 stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-60 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
              </h2>
            </div>

            {/* Annotation floating to the right — with clean arrow below it */}
            <div className="relative flex flex-col items-end md:items-end mt-1 md:mt-0 hidden md:flex">
              <span className="text-[#3b82f6] font-['Caveat'] text-2xl -rotate-2 inline-block">
                sélectionné pour vous
              </span>
              {/* Clean curved arrow under annotation pointing left-down toward title */}
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
          className="relative -mx-4 px-4 md:mx-0 md:px-0"
          style={{
            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
          }}
        >
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
              {currentProducts.map((product, index) => {
                const badgeText = product.badges && product.badges.length > 0 ? product.badges[0] : null;
                const dynamicRating = product.grade === 'A' ? 5 : 4;
                const dynamicReviews = 42 + index * 7;

                return (
                  <motion.div
                    key={`${activeTab}-${product.id}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex-none w-[240px] snap-start"
                  >
                    <div className="h-full border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.1)] transition-shadow rounded-3xl flex flex-col relative bg-white overflow-hidden group">

                      {badgeText && (
                        <div className="absolute top-4 left-4 z-10">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide uppercase ${
                            badgeText.toLowerCase().includes('promo') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {badgeText}
                          </span>
                        </div>
                      )}

                      <Link href={`/products/${product.id}`} className="block relative h-[220px] w-full p-6 pt-12 pointer-events-none md:pointer-events-auto flex items-center justify-center bg-slate-50/50 group-hover:bg-slate-50 transition-colors">
                        <img src={product.image} alt={product.name} className="w-auto h-[140px] object-contain drop-shadow-md mix-blend-multiply transition-transform duration-500 group-hover:scale-110" />
                      </Link>

                      <div className="p-5 flex flex-col flex-grow">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1">{product.brand}</span>
                        <Link href={`/products/${product.id}`} className="block w-fit">
                          <h3 className="font-bold text-[#0A0F1E] text-base leading-tight mb-1.5 group-hover:text-[#3b82f6] transition-colors">
                            {product.name}
                          </h3>
                        </Link>

                        <p className="text-[13px] text-slate-500 font-medium mb-3 leading-tight pr-2">
                          {product.storage}Go - {product.color} - Grade {product.grade}
                        </p>

                        <div className="flex items-center gap-1.5 mb-5">
                          <div className="flex gap-0.5 text-[#FFB800]">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i < dynamicRating ? 'fill-current' : 'text-slate-200 fill-slate-200'}`} />
                            ))}
                          </div>
                          <span className="text-[11px] font-medium text-slate-400">({dynamicReviews})</span>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex flex-col items-start leading-none">
                            {product.originalPrice && (
                              <span className="text-[11px] text-slate-400 font-bold line-through mb-1">
                                {product.originalPrice.toFixed(2).replace('.', ',')} €
                              </span>
                            )}
                            <span className="text-[22px] font-black text-[#0A0F1E] tracking-tight">
                              {product.price.toFixed(2).replace('.', ',')} €
                            </span>
                          </div>

                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addItem({
                                id: `${product.id}-${Date.now()}`,
                                productId: product.id,
                                name: product.name,
                                price: product.price,
                                image: product.image,
                                quantity: 1,
                                storage: product.storage,
                                grade: product.grade,
                                color: product.color
                              });
                              openCart();
                            }}
                            className="w-10 h-10 rounded-full bg-[#2563EB] hover:bg-blue-700 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-blue-500/30 transition-transform active:scale-95 group/btn"
                          >
                            <ShoppingCart className="w-4 h-4 transition-transform group-hover/btn:-rotate-12" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </section>
  );
}
