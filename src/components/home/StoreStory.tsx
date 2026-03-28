'use client';

import { motion } from 'framer-motion';

export function StoreStory() {
  return (
    <section className="py-24 bg-[#F9F8F5] overflow-hidden">
      <div className="container max-w-7xl px-4 mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-start"
          >
            {/* Annotation with properly spaced arrow below — min 8px gap */}
            <div className="mb-6">
              <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block">
                fait avec passion
              </p>
              {/* Arrow below with proper spacing (mt-2 = 8px) */}
              <div className="mt-2 hidden sm:block">
                <svg width="48" height="32" viewBox="0 0 48 32" className="fill-none" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 40 4 C 28 4 8 10 6 24" stroke="#3b82f6" strokeWidth="1.5"/>
                  <path d="M 6 24 L 2 16 M 6 24 L 14 20" stroke="#3b82f6" strokeWidth="1.5"/>
                </svg>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-black mb-10 leading-[1.1] tracking-tight text-[#0A0F1E] relative">
              Pas un entrepôt.<br />
              <span className="relative inline-block text-[#3b82f6]">
                Une vraie boutique.
                {/* Wavy Underline */}
                <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-70" style={{strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px'}}>
                  <path d="M 0 10 Q 12 0 25 10 T 50 10 T 75 10 T 100 10"/>
                </svg>
              </span>
            </h2>

            <ul className="space-y-6 mb-10">
              {[
                { label: "Équipe locale", desc: "Tout est géré depuis nos locaux à Angers" },
                { label: "Diagnostic précis", desc: "Chaque appareil passe entre nos mains expertes" },
                { label: "SAV direct", desc: "Pas de centre d'appels délocalisés, nous vous répondons directement" },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="mt-1 w-6 h-6 rounded-full bg-[#3b82f6]/10 flex items-center justify-center shrink-0 border border-[#3b82f6]/20">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                  </span>
                  <span className="text-slate-600 font-medium text-lg leading-relaxed">
                    <strong className="text-[#0A0F1E]">{item.label}</strong> — <span className="text-slate-500">{item.desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="relative">
              <a 
                href="https://www.google.com/maps/place/Tel+and+Cash+Angers/@47.4734511,-0.5521127,17z/data=!3m1!4b1!4m6!3m5!1s0x480879224532671b:0x482a7e7aeb686dcb!8m2!3d47.4734475!4d-0.5495324!16s%2Fg%2F11y6p17ml6?entry=ttu&g_ep=EgoyMDI2MDMyNC4wIKXMDSoASAFQAw%3D%3D&directionsmode=driving" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border-2 border-[#0A0F1E] text-[#0A0F1E] font-bold text-lg px-8 py-3.5 rounded-xl hover:bg-[#0A0F1E] hover:text-white transition-colors shadow-sm relative z-10 bg-white hover:shadow-xl hover:shadow-slate-900/20"
              >
                Nous rendre visite
              </a>
              {/* Sparkle near CTA */}
              <svg width="22" height="22" viewBox="0 0 24 24" className="absolute -top-2 -right-6 stroke-yellow-400 fill-none stroke-[1.5px] opacity-100 z-0 animate-pulse hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
              </svg>
            </div>
          </motion.div>

          <motion.div
            className="flex justify-center relative mt-16 md:mt-0"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative">
              <div
                className="w-[300px] h-[340px] md:w-[360px] md:h-[460px] overflow-hidden"
                style={{
                  borderRadius: '16px',
                  border: '10px solid white',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
                  transform: 'rotate(2deg)',
                }}
              >
                <img
                  src="/boutique.jpg"
                  alt="Boutique Tel & Cash Angers"
                  className="w-full h-full object-cover hover:scale-105 transition-all duration-700"
                />
              </div>

              {/* Badge ⭐ 5/5 — refined style */}
              <motion.div
                animate={{ y: [-3, 3, -3] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-2xl px-4 py-3 border border-slate-100 flex items-center gap-2.5 z-20 min-w-[90px]"
              >
                <div className="w-8 h-8 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center text-base shrink-0">⭐</div>
                <div className="flex flex-col">
                  <span className="text-[#0A0F1E] font-black text-sm leading-none">5/5</span>
                  <span className="text-slate-400 text-[10px] font-semibold tracking-wide">Google</span>
                </div>
              </motion.div>

              {/* Badge 📍 Angers — refined style */}
              <motion.div
                animate={{ y: [3, -3, 3] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-6 -left-6 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-2xl px-4 py-3 border border-slate-100 flex items-center gap-2.5 z-20"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-base shrink-0">📍</div>
                <div className="flex flex-col">
                  <span className="text-[#0A0F1E] font-black text-sm leading-none">Angers</span>
                  <span className="text-slate-400 text-[10px] font-semibold tracking-wide">Maine-et-Loire</span>
                </div>
              </motion.div>

              {/* Badge +5 ans d'expérience — refined style */}
              <motion.div
                animate={{ y: [-2, 4, -2] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                className="absolute top-1/2 -right-14 bg-[#0A0F1E] text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)] rounded-2xl px-4 py-3 border border-white/10 z-20 flex items-center gap-2"
              >
                <span className="text-lg">✦</span>
                <div className="flex flex-col">
                  <span className="font-black text-sm leading-none">+5 ans</span>
                  <span className="text-white/60 text-[10px] font-semibold tracking-wide">d'expérience</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
