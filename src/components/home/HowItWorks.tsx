'use client';

import { motion } from 'framer-motion';
import { Search, ShoppingCart, Truck, Smile } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      num: "1",
      title: "Parcourez notre catalogue",
      description: "Choisissez parmi plus de 500 références de smartphones reconditionnés.",
      icon: <Search className="w-6 h-6" />
    },
    {
      num: "2",
      title: "Choisissez votre modèle",
      description: "Sélectionnez la couleur, le stockage et le grade qui vous correspond.",
      icon: <ShoppingCart className="w-6 h-6" />
    },
    {
      num: "3",
      title: "Recevez votre smartphone",
      description: "Expédition le jour même et livraison gratuite en 24h/48h chez vous.",
      icon: <Truck className="w-6 h-6" />
    },
    {
      num: "4",
      title: "Profitez de votre appareil",
      description: "Déballez, insérez votre SIM et profitez avec une garantie de 24 mois.",
      icon: <Smile className="w-6 h-6" />
    }
  ];

  return (
    <section className="py-24 bg-[#0A0F1E] text-white relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#2563EB]/10 blur-[120px] rounded-full pointer-events-none" />


      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="text-center mb-20">

          {/* Cursive annotation — light blue, readable on dark navy */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-[#93c5fd] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
              simple comme bonjour
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" className="stroke-[#93c5fd] fill-none stroke-[1.5px] opacity-80" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
              <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
            </svg>
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-black tracking-tight mb-4 relative inline-block"
          >
            Comment ça marche ?
            {/* Wavy underline — white/light blue on dark */}
            <svg viewBox="0 0 220 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-50" style={{strokeLinecap: 'round', stroke: '#93c5fd', strokeWidth: '1.5px'}}>
              <path d="M 0 6 Q 18 0 36 6 T 73 6 T 110 6 T 147 6 T 183 6 T 220 6"/>
            </svg>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/70 max-w-2xl mx-auto mt-6"
          >
            En 4 étapes simples, donnez une seconde vie à un smartphone premium tout en faisant des économies.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 relative">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative flex flex-col items-center text-center lg:items-start lg:text-left group"
            >
              <div className="relative mb-8 inline-block lg:w-fit text-left z-10">
                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#3b82f6] relative z-10 backdrop-blur-sm group-hover:scale-110 group-hover:bg-[#3b82f6] group-hover:text-white transition-all duration-300 shadow-xl shadow-black/50 mx-auto lg:mx-0">
                  {step.icon}
                </div>
                <div className="absolute -top-4 -right-4 text-6xl font-black text-white/5 select-none transition-all duration-300 group-hover:text-white/10 group-hover:-translate-y-2 group-hover:translate-x-2">
                  {step.num}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white relative z-10">{step.title}</h3>
              <p className="text-white/60 leading-relaxed font-medium relative z-10">{step.description}</p>

              {/* Curved arrow beautifully centered between the exact midpoint of columns */}
              {index < steps.length - 1 && (
                <div 
                  className="hidden lg:flex absolute top-[40px] z-0 -translate-y-1/2 items-center justify-center pointer-events-none"
                  style={{ left: '80px', width: 'calc(100% - 80px + 32px)' }}
                >
                  <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-[100px] xl:w-[130px] h-6 fill-none overflow-visible opacity-50" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                    <path d="M 0 16 C 30 0 70 0 100 16" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                    <path d="M 100 16 L 94 10 M 100 16 L 92 20" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
                  </svg>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
