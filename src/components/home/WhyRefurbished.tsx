'use client';

import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

export function WhyRefurbished() {
  return (
    <section className="py-24 bg-[#F9F8F5] relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">

          {/* Left Column (Content) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-start"
          >
            {/* Handwritten annotation — arrow placed BELOW with 10px margin */}
            <div className="mb-5 ml-1">
              <div className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
                on vous explique tout
              </div>
              {/* Arrow below annotation pointing down-left toward title — proper spacing */}
              <div className="mt-2 hidden sm:block">
                <svg width="48" height="32" viewBox="0 0 48 32" className="fill-none" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 40 4 C 28 4 10 8 6 24" stroke="#3b82f6" strokeWidth="1.5"/>
                  <path d="M 6 24 L 2 16 M 6 24 L 14 20" stroke="#3b82f6" strokeWidth="1.5"/>
                </svg>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-8 leading-[1.1] text-[#0A0F1E]">
              Un smartphone reconditionné,<br /> c'est quoi exactement ?
            </h2>

            <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-xl font-medium leading-relaxed">
              Un téléphone reconditionné a été collecté, diagnostiqué, réparé si nécessaire, puis testé sur plus de 60 points de contrôle par nos techniciens passionnés.
            </p>

            {/* Premium Grid 2x2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">

              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100/60 flex flex-col gap-3 group hover:border-blue-200 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 rounded-bl-full pointer-events-none" />
                <svg width="32" height="32" viewBox="0 0 40 40" className="stroke-[#3b82f6] fill-none stroke-2 shrink-0 mb-1" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 12 20 L 18 26 L 28 12" />
                  <circle cx="20" cy="20" r="16" strokeDasharray="4 4" className="animate-[spin_20s_linear_infinite]" />
                </svg>
                <div className="relative z-10">
                  <div className="font-bold text-[#0A0F1E] text-lg flex items-center gap-2">
                    +60 points
                    <svg width="14" height="14" viewBox="0 0 24 24" className="stroke-[#3b82f6] fill-none stroke-[3px]" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div className="text-sm font-medium text-slate-500">de contrôle stricts</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100/60 flex flex-col gap-3 group hover:border-[#22c55e]/30 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50/50 rounded-bl-full pointer-events-none" />
                <svg width="32" height="32" viewBox="0 0 40 40" className="stroke-[#22c55e] fill-none stroke-2 shrink-0 mb-1" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <rect x="8" y="12" width="20" height="16" rx="2" />
                  <path d="M 28 16 L 31 16 C 32 16 33 17 33 18 L 33 22 C 33 23 32 24 31 24 L 28 24" />
                  <path d="M 12 16 L 12 24 M 16 16 L 16 24 M 20 16 L 20 24" strokeWidth="3" />
                </svg>
                <div className="relative z-10">
                  <div className="font-bold text-[#0A0F1E] text-lg flex items-center gap-2">
                    Batterie
                    <svg width="14" height="14" viewBox="0 0 24 24" className="stroke-[#22c55e] fill-none stroke-[3px]" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div className="text-sm font-medium text-slate-500">certifiée ≥85%</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100/60 flex flex-col gap-3 group hover:border-purple-200 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-50/50 rounded-bl-full pointer-events-none" />
                <svg width="32" height="32" viewBox="0 0 40 40" className="stroke-purple-600 fill-none stroke-2 shrink-0 mb-1" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 10 20 A 10 10 0 0 1 30 20 A 10 10 0 0 1 10 20 Z" />
                  <path d="M 10 20 L 15 15 M 10 20 L 15 25" />
                  <path d="M 30 20 L 25 15 M 30 20 L 25 25" />
                </svg>
                <div className="relative z-10">
                  <div className="font-bold text-[#0A0F1E] text-lg flex items-center gap-2">
                    Retour 30j
                    <svg width="14" height="14" viewBox="0 0 24 24" className="stroke-purple-500 fill-none stroke-[3px]" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div className="text-sm font-medium text-slate-500">Satisfait ou remboursé</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-3xl border-2 border-slate-100/60 flex flex-col gap-3 group hover:border-amber-200 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50/50 rounded-bl-full pointer-events-none" />
                <svg width="32" height="32" viewBox="0 0 40 40" className="stroke-amber-500 fill-none stroke-2 shrink-0 mb-1" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 20 5 L 32 10 L 32 20 C 32 28 20 35 20 35 C 20 35 8 28 8 20 L 8 10 Z" />
                  <path d="M 16 18 L 20 22 L 26 14" />
                </svg>
                <div className="relative z-10">
                  <div className="font-bold text-[#0A0F1E] text-lg flex items-center gap-2">
                    Garantie 24 mois
                    <svg width="14" height="14" viewBox="0 0 24 24" className="stroke-amber-400 fill-none stroke-[3px]" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div className="text-sm font-medium text-slate-500">Sérénité totale incluse</div>
                </div>
              </div>

            </div>
          </motion.div>

          {/* Right Column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mt-8 md:mt-0 px-4 flex justify-center"
          >
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[400px] aspect-square bg-[#3b82f6] blur-[100px] opacity-[0.08] rounded-full pointer-events-none" />

            {/* Clean fluid arc around the mockup — properly spaced */}
            <svg viewBox="0 0 400 400" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%] max-w-[580px] fill-none pointer-events-none -rotate-12" style={{strokeLinecap: 'round', strokeDasharray: '18 10', stroke: '#3b82f6', strokeWidth: '1.5', opacity: 0.18}}>
              <circle cx="200" cy="200" r="178" />
            </svg>

            <div
              className="relative rounded-[20px] overflow-hidden z-10 max-w-[400px] w-full rotate-2"
              style={{
                boxShadow: '0 0 40px rgba(37,99,235,0.15), 0 20px 50px rgba(0,0,0,0.1)',
              }}
            >
              <img
                src="/smartphone-reconditionne.jpg"
                alt="Smartphone Reconditionné Tel & Cash"
                className="w-full aspect-[4/5] object-cover scale-105 hover:scale-100 transition-transform duration-1000"
              />
            </div>

            {/* Floating icon badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="absolute top-10 -left-6 md:-left-4 bg-white rounded-full p-4 shadow-xl border border-slate-100 z-20 animate-levitate"
              style={{ animationDelay: '0.2s' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" className="stroke-[#3b82f6] fill-none stroke-2" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="11" />
                <line x1="11" y1="14" x2="11.01" y2="14" />
              </svg>
            </motion.div>

            {/* "Comme neuf" badge — redesigned to match Warranty badge style */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="absolute -bottom-6 -right-6 md:-right-4 z-20"
            >
              <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-3 min-w-[210px]">
                <div className="w-9 h-9 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#3b82f6]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-['Caveat'] text-[#3b82f6] text-xl leading-tight">Comme neuf !</span>
                  <span className="text-[#0A0F1E] font-bold text-sm">100% fonctionnel garanti</span>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </section>
  );
}
