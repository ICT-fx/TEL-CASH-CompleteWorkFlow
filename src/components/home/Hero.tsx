'use client';

import { motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, Star, Truck, Shield } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-white">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-[url('/hero-final.jpg')] bg-cover bg-no-repeat"
          style={{
            backgroundPosition: 'center 15%',
            imageRendering: '-webkit-optimize-contrast' as any
          }}
        />
        <div className="absolute inset-y-0 left-0 z-10 w-full lg:w-[45%] bg-gradient-to-r from-white to-transparent" />
      </div>

      <div className="container mx-auto px-4 max-w-7xl relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col items-start text-left py-12 md:py-20"
          >
            {/* Badge with sparkle */}
            <motion.div variants={item} className="mb-6 relative inline-flex items-center rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-600 border border-blue-100">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Smartphones reconditionnés premium
              {/* Sparkle near badge */}
              <svg width="14" height="14" viewBox="0 0 24 24" className="absolute -top-2 -right-3 stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-70 animate-pulse" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
              </svg>
            </motion.div>

            <div className="relative mb-6">
              <motion.h1 variants={item} className="text-4xl md:text-5xl lg:text-[64px] font-black uppercase tracking-tighter text-slate-900 leading-[1.05]">
                <span className="whitespace-nowrap">ACHETEZ VOTRE</span> <br />
                <span className="text-blue-600">SMARTPHONE</span> <br />
                <span className="whitespace-nowrap">AU MEILLEUR PRIX</span>
              </motion.h1>

              <div className="absolute -right-4 top-0 hidden xl:flex flex-col gap-3 translate-x-full">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="bg-white/60 backdrop-blur-xl px-4 py-2.5 rounded-[12px] shadow-[0_8px_32px_rgba(37,99,235,0.1)] border border-white/20 flex items-center gap-2.5"
                >
                  <Shield className="w-4 h-4 text-[#2563eb]" />
                  <span className="text-xs font-medium text-[#1e3a5f] whitespace-nowrap">Batterie testée +85%</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 1.0 }}
                  className="bg-white/60 backdrop-blur-xl px-4 py-2.5 rounded-[12px] shadow-[0_8px_32px_rgba(37,99,235,0.1)] border border-white/20 flex items-center gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />
                  <span className="text-xs font-medium text-[#1e3a5f] whitespace-nowrap">Garantie 24 mois</span>
                </motion.div>
              </div>
            </div>

            <motion.p variants={item} className="text-lg md:text-xl text-slate-600 mb-8 max-w-lg font-medium">
              iPhone, Samsung & Xiaomi • Testés & certifiés en France • Garantis 24 mois
            </motion.p>

            <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 w-full justify-start mb-12">
              <Link href="/products">
                <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20">
                  Voir les smartphones
                </Button>
              </Link>
              <Link href="/products?sort=promo">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg h-14 px-8 rounded-full bg-white/50 backdrop-blur-sm border-slate-200 text-slate-700 hover:bg-white/80">
                  Nos meilleures offres
                </Button>
              </Link>
            </motion.div>

            {/* Stats bar with sparkle near the rating */}
            <motion.div variants={item} className="flex flex-wrap items-center justify-start gap-x-6 gap-y-3 text-sm font-medium text-slate-500 bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/30 relative">
              <div className="flex items-center gap-1.5 relative">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span>5/5 Avis</span>
                {/* Sparkle near rating */}
                <svg width="12" height="12" viewBox="0 0 24 24" className="absolute -top-3 -right-3 stroke-yellow-400 fill-none stroke-[1.5px] opacity-70 animate-pulse" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>+15 000 clients</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-500" />
                <span>Livraison express</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Garantie 24 mois</span>
              </div>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block h-1" />
        </div>
      </div>
    </section>
  );
}
