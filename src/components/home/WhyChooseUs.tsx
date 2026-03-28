'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function WhyChooseUs() {
  return (
    <section className="py-24 bg-[#0A0F1E] text-white overflow-hidden relative border-y border-[#2563EB]/10">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2563EB]/15 blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3" />

      {/* Decorative Dots */}
      <svg className="absolute top-12 left-12 w-20 h-20 opacity-30" viewBox="0 0 100 100">
        <circle cx="10" cy="10" r="2" fill="#3b82f6"/>
        <circle cx="30" cy="10" r="2" fill="#3b82f6"/>
        <circle cx="50" cy="10" r="2" fill="#3b82f6"/>
        <circle cx="10" cy="30" r="2" fill="#3b82f6"/>
        <circle cx="10" cy="50" r="2" fill="#3b82f6"/>
      </svg>
      <svg className="absolute bottom-12 right-12 w-20 h-20 opacity-30 transform rotate-180" viewBox="0 0 100 100">
        <circle cx="10" cy="10" r="2" fill="#3b82f6"/>
        <circle cx="30" cy="10" r="2" fill="#3b82f6"/>
        <circle cx="50" cy="10" r="2" fill="#3b82f6"/>
        <circle cx="10" cy="30" r="2" fill="#3b82f6"/>
        <circle cx="10" cy="50" r="2" fill="#3b82f6"/>
      </svg>

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">

          {/* Left Column (Text & Stats) */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-start relative"
          >
            {/* Cursive annotation + Sparkle */}
            <div className="flex items-center gap-2 mb-3 ml-1">
              <div className="text-[#93c5fd] font-['Caveat'] text-2xl md:text-3xl -rotate-2">
                le choix intelligent
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" className="stroke-[#93c5fd] fill-none stroke-[1.5px] opacity-80 animate-pulse" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
              </svg>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-[52px] font-black tracking-tight mb-8 leading-[1.1] relative">
              Jusqu'à <span className="text-[#3b82f6] relative inline-block">
                -70%
                {/* Elegant curved arrow above -70% — properly spaced, fluide */}
                <svg
                  width="56" height="48" viewBox="0 0 56 48"
                  className="absolute -top-12 -right-16 fill-none opacity-90"
                  style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}
                >
                  {/* Smooth arc from top-right curving down to point at -70% */}
                  <path d="M 48 6 C 40 4 20 8 8 30" stroke="#93c5fd" strokeWidth="1.5"/>
                  {/* Arrowhead at end */}
                  <path d="M 8 30 L 4 22 M 8 30 L 16 26" stroke="#93c5fd" strokeWidth="1.5"/>
                </svg>
              </span><br />
              sur les <span className="relative">
                meilleurs smartphones
                {/* Wavy Underline */}
                <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-4 left-0 w-full h-3 fill-none opacity-70" style={{strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px'}}>
                  <path d="M 0 6 Q 20 0 40 6 T 80 6 T 120 6 T 160 6 T 200 6"/>
                </svg>
              </span>
            </h2>

            <p className="text-lg md:text-xl text-slate-400 mt-4 mb-12 max-w-lg font-medium leading-relaxed">
              Ne choisissez plus entre qualité et prix. Profitez de la même expérience qu'un appareil neuf, avec une garantie totale et un prix qui a enfin du sens.
            </p>

            {/* Structured Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 w-full mb-12 border-l-2 sm:border-l-0 border-[#3b82f6]/30 pl-6 sm:pl-0 sm:border-t sm:border-white/10 sm:pt-10">
              <div className="flex flex-col leading-tight">
                <div className="text-3xl md:text-4xl font-black text-white mb-2">500K</div>
                <div className="text-sm font-bold text-[#3b82f6] tracking-wide uppercase">Clients ravis</div>
              </div>
              <div className="flex flex-col leading-tight">
                <div className="text-3xl md:text-4xl font-black text-white mb-2">24 mois</div>
                <div className="text-sm font-bold text-[#3b82f6] tracking-wide uppercase">De garantie</div>
              </div>
              <div className="flex flex-col leading-tight">
                <div className="text-3xl md:text-4xl font-black text-white mb-2">350€</div>
                <div className="text-sm font-bold text-[#3b82f6] tracking-wide uppercase">Économisés moy.</div>
              </div>
            </div>

            <div className="relative">
              <svg width="20" height="20" viewBox="0 0 24 24" className="absolute -top-4 -right-8 stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-60 animate-pulse" style={{strokeLinecap: 'round'}}>
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
              </svg>

              <Link href="/products">
                <Button className="px-8 py-3.5 text-base font-semibold rounded-lg bg-white text-[#0A0F1E] transition-all flex items-center gap-2 group shadow-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] animate-levitate hover:animate-none">
                  Découvrir nos offres
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Right Column (Staging) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex justify-center items-center p-4 md:p-8"
          >
            {/* The Visual Stage */}
            <div className="relative w-full max-w-[460px] aspect-[4/5] rounded-[2.5rem] bg-gradient-to-tr from-[#1E293B]/40 to-[#0F172A]/80 border border-white/10 shadow-2xl flex items-center justify-center p-12 overflow-visible">

              <motion.div
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full z-10"
              >
                <div className="absolute inset-0 bg-[#3b82f6] blur-[80px] opacity-20 transform scale-75" />
                <img
                  src="https://www.pngmart.com/files/22/iPhone-14-Pro-PNG-Isolated-HD.png"
                  alt="Smartphone Premium Reconditionné"
                  className="w-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-10 -rotate-6"
                />
              </motion.div>

              {/* Warranty Badge — reference style */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute top-10 -left-6 md:-left-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] z-20 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-[#3b82f6]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm">Garantie 24 mois</span>
                  <span className="text-white/60 text-[10px] tracking-wider uppercase font-semibold">Incluse</span>
                </div>
              </motion.div>

              {/* Pricing Badge — redesigned to match Warranty Badge style */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="absolute -bottom-8 md:-bottom-12 -right-8 md:-right-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] z-30 flex flex-col gap-1 min-w-[170px]"
              >
                <span className="text-slate-200 text-xs font-semibold line-through tracking-wide">859€ Neuf</span>
                <span className="font-black text-white text-3xl tracking-tight leading-none">499€</span>
                <div className="mt-1 bg-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide text-center">
                  Tu économises 360€
                </div>
              </motion.div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
