'use client';

import { motion, type Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function Categories() {
  const categories = [
    {
      title: "iPhone",
      subtitle: "Tous les modèles d'iPhone reconditionnés",
      image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80",
      link: "/products?brand=apple",
    },
    {
      title: "Accessoires",
      subtitle: "Coques, chargeurs, câbles, écouteurs...",
      image: "https://images.unsplash.com/photo-1615526675159-e248c3021d3f?auto=format&fit=crop&w=800&q=80",
      link: "/products",
    },
    {
      title: "Smartphones Android",
      subtitle: "Samsung, Xiaomi et plus",
      image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80",
      link: "/products?brand=android",
    }
  ];

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
  };

  return (
    <section className="py-24 bg-[#F9F8F5]">
      <div className="container mx-auto px-4 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 relative"
        >
          {/* Cursive annotation */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
              notre univers
            </span>
            {/* Sparkle */}
            <svg width="18" height="18" viewBox="0 0 24 24" className="stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-80 animate-pulse" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
              <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
            </svg>
          </div>

          {/* Title with wavy underline */}
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-[#0A0F1E] relative inline-block">
            La référence du reconditionné premium.
            {/* Wavy underline */}
            <svg viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 stroke-[#3b82f6] fill-none opacity-60" style={{strokeWidth: '1.5px', strokeLinecap: 'round'}}>
              <path d="M 0 6 Q 25 0 50 6 T 100 6 T 150 6 T 200 6 T 250 6 T 300 6"/>
            </svg>
          </h2>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
        >
          {categories.map((category, index) => (
            <motion.div key={index} variants={item} className="h-full">
              <Link
                href={category.link}
                className="group relative block w-full h-[160px] md:h-[200px] rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-[4px] bg-slate-900"
              >
                {/* Background Image with Zoom on Hover */}
                <div className="absolute inset-0 w-full h-full overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>

                {/* Dark Gradient Overlay for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 group-hover:opacity-90" />

                {/* Light Sweep Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] group-hover:animate-sweep" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-end text-white z-10 w-full">
                  <div className="flex items-end justify-between w-full">
                    <div className="pr-2">
                      {/* Title with small wavy underline */}
                      <h3 className="text-xl md:text-2xl font-bold mb-1 md:mb-2 text-white relative inline-block">
                        {category.title}
                        {/* Small wavy underline under label */}
                        <svg viewBox="0 0 80 8" preserveAspectRatio="none" className="absolute -bottom-1 left-0 w-full h-2 stroke-white/60 fill-none" style={{strokeWidth: '1.5px', strokeLinecap: 'round'}}>
                          <path d="M 0 4 Q 10 0 20 4 T 40 4 T 60 4 T 80 4"/>
                        </svg>
                      </h3>
                      <p className="text-slate-200 text-xs md:text-sm font-medium opacity-90 line-clamp-1 mt-1">{category.subtitle}</p>
                    </div>

                    {/* Arrow Icon with Hover Slide */}
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 transition-all duration-300 group-hover:bg-[#3b82f6] group-hover:border-[#3b82f6] group-hover:text-white">
                      <ArrowRight className="w-4 h-4 text-white transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
