'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Circle, Check } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/store/useCart';

export function BestSeller() {
  const { addItem, openCart } = useCart();
  return (
    <section className="py-16 md:py-20 bg-[#F9F8F5] relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col mb-12 items-center text-center relative">
          {/* Cursive annotation above title */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
              le plus demandé
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" className="stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-80 animate-pulse" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
              <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
            </svg>
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-black tracking-tight text-[#0A0F1E] mb-3 relative inline-block"
          >
            Le choix de l'excellence.
            {/* Wavy underline */}
            <svg viewBox="0 0 280 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-60" style={{strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px'}}>
              <path d="M 0 6 Q 23 0 46 6 T 92 6 T 138 6 T 184 6 T 230 6 T 280 6"/>
            </svg>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-500 max-w-2xl font-medium mt-5"
          >
            Notre modèle le plus plébiscité. Performance brute et design intemporel, reconditionné à la perfection dans nos locaux.
          </motion.p>
        </div>

        <div className="rounded-[32px] p-6 md:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center relative overflow-visible border border-slate-200/60 shadow-md bg-white">

          {/* Subtle Abstract Background */}
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-blue-100/40 blur-[100px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />

          {/* Left: Product Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative flex justify-center items-center h-full min-h-[350px] lg:min-h-[450px]"
          >
            <motion.img
              initial={{ y: 20 }}
              whileInView={{ y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              src="https://www.pngmart.com/files/22/iPhone-14-Pro-PNG-Isolated-HD.png"
              alt="iPhone Reconditionné"
              className="w-[75%] max-w-[340px] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.12)] z-10"
            />
          </motion.div>

          {/* Right: Product Details */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-start relative z-10"
          >
            <div className="relative mb-5">
              <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] font-bold text-[11px] tracking-widest uppercase">
                ✦ notre best-seller
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" className="absolute -top-3 -right-5 stroke-yellow-400 fill-none stroke-[1.5px] opacity-100 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
              </svg>
            </div>

            <h3 className="text-4xl md:text-5xl font-black text-[#0A0F1E] mb-4 tracking-tight relative inline-block">
              iPhone 14 Pro
              {/* Wavy Underline */}
              <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-[140px] h-3 fill-none opacity-70" style={{strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px'}}>
                <path d="M 0 10 Q 12 0 25 10 T 50 10 T 75 10 T 100 10"/>
              </svg>

              {/* Clean curved arrow pointing to description block as requested */}
              <svg width="60" height="70" viewBox="0 0 60 70" className="absolute top-2 -right-[70px] fill-none hidden sm:block overflow-visible" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M 0 14 C 40 14 50 20 40 60" stroke="#0ea5e9" strokeWidth="3" opacity="0.9" />
                <path d="M 40 60 L 48 52 M 40 60 L 34 54" stroke="#0ea5e9" strokeWidth="3" opacity="0.9" />
              </svg>
            </h3>

            <p className="text-sm md:text-base text-slate-600 font-medium mb-6 leading-relaxed max-w-md mt-2">
              Appareil photo stellaire 48 Mpx, autonomie longue durée et résistance à l'eau. Un bijou technologique totalement prêt à vous accompagner partout.
            </p>

            {/* Price with clean curved arrow */}
            <div className="flex items-baseline gap-3 mb-6 relative">
              <span className="text-3xl md:text-4xl font-black text-[#3b82f6]">849€</span>
              <span className="text-sm text-slate-400 font-medium tracking-wide">au lieu de <span className="line-through">1199€</span></span>
            </div>

            {/* Selectors */}
            <div className="flex gap-10 w-full mb-8">
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finition</span>
                <div className="flex gap-2.5">
                  <button className="w-6 h-6 rounded-full bg-[#4A4846] ring-2 ring-offset-2 ring-slate-900 cursor-pointer shadow-sm" />
                  <button className="w-6 h-6 rounded-full bg-[#F3F2F0] hover:ring-2 ring-offset-2 ring-slate-300 transition-all cursor-pointer shadow-sm border border-slate-200" />
                  <button className="w-6 h-6 rounded-full bg-[#E0D5C9] hover:ring-2 ring-offset-2 ring-slate-300 transition-all cursor-pointer shadow-sm border border-slate-200" />
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stockage</span>
                <div className="flex gap-4">
                  <button className="text-sm font-bold text-[#0A0F1E] pb-0.5 border-b-2 border-[#0A0F1E] transition-all">128 Go</button>
                  <button className="text-sm font-medium text-slate-400 pb-0.5 border-b-2 border-transparent hover:text-slate-600 transition-all">256 Go</button>
                </div>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="px-3 py-1 bg-white border border-slate-200 text-[#0A0F1E] text-xs font-bold rounded-md shadow-sm">5G</div>
              <div className="px-3 py-1 bg-white border border-slate-200 text-[#0A0F1E] text-xs font-bold rounded-md shadow-sm">Écran OLED</div>
              <div className="px-3 py-1 bg-white border border-slate-200 text-[#0A0F1E] text-xs font-bold rounded-md shadow-sm">Charge rapide</div>
              <div className="px-3 py-1 bg-white border border-slate-200 text-[#0A0F1E] text-xs font-bold rounded-md shadow-sm">Double SIM</div>
            </div>

            {/* Ce qui est inclus */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 w-full mb-8 relative">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">Ce qui est inclus</span>
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold"><Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> Chargeur rapide inclus</li>
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold"><Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> Boîte premium</li>
                <li className="flex items-center gap-2 text-sm text-[#0A0F1E] font-semibold"><Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> Garantie 24 mois</li>
              </ul>
            </div>

            {/* Minimal Stock Indicator */}
            <div className="flex items-center gap-2 mb-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
              <span>En stock, expédié aujourd'hui</span>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <Button 
                onClick={() => {
                  addItem({
                    id: `best-seller-9-${Date.now()}`,
                    productId: '9',
                    name: 'iPhone 14 Pro',
                    price: 849,
                    image: 'https://www.pngmart.com/files/22/iPhone-14-Pro-PNG-Isolated-HD.png',
                    quantity: 1,
                    storage: '128',
                    grade: 'A',
                    color: 'Noir sidéral'
                  });
                  openCart();
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-500/20 transition-all"
              >
                Ajouter au panier
              </Button>
              <Link href="/products/9" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#0A0F1E] rounded-lg text-sm font-semibold px-6 py-2.5 transition-all bg-white">
                  Voir la fiche détaillée
                </Button>
              </Link>
            </div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}
