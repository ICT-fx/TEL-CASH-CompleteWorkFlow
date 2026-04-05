'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

/* ─────────────────────── SVG helpers ─────────────────────── */

const CurvedArrowRight = ({ color = '#3b82f6' }: { color?: string }) => (
  <svg width="48" height="32" viewBox="0 0 48 32" fill="none" style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}>
    <path d="M 40 4 C 28 4 8 10 6 24" stroke={color} strokeWidth="1.5" />
    <path d="M 6 24 L 2 16 M 6 24 L 14 20" stroke={color} strokeWidth="1.5" />
  </svg>
);

const Sparkle = ({ className = '', size = 20, color = '#3b82f6' }: { className?: string; size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={`fill-none stroke-[1.5px] ${className}`}
    style={{ stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round' }}
  >
    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
  </svg>
);

const WavyUnderline = ({ color = '#3b82f6' }: { color?: string }) => (
  <svg
    viewBox="0 0 200 12"
    preserveAspectRatio="none"
    className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-60"
    style={{ strokeLinecap: 'round', stroke: color, strokeWidth: '1.5px' }}
  >
    <path d="M 0 6 Q 20 0 40 6 T 80 6 T 120 6 T 160 6 T 200 6" />
  </svg>
);

/* ─────────────────────── Page ─────────────────────── */

export default function QuiSommesNousPage() {
  return (
    <main>

      {/* ── HERO ── */}
      <section className="py-28 bg-[#F9F8F5] overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/4" />

        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          {/* Cursive annotation */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4 flex items-center justify-center gap-2"
          >
            <span className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block">
              notre histoire
            </span>
            <Sparkle size={18} color="#3b82f6" className="opacity-70 animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl font-black tracking-tight text-[#0A0F1E] mb-6 leading-[1.1]"
          >
            Pas une chaîne.<br />
            <span className="text-[#3b82f6] relative inline-block">
              Une équipe.
              <WavyUnderline />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Tel &amp; Cash est née d'une conviction simple&nbsp;: on mérite mieux qu'un téléphone neuf hors de prix.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-6 py-2.5 shadow-sm text-sm font-semibold text-[#0A0F1E]"
          >
            <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse inline-block" />
            Fondée à Angers · 2019
          </motion.div>
        </div>
      </section>

      {/* ── D'OÙ ON VIENT ── */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Left: text */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-start"
            >
              {/* Annotation */}
              <div className="mb-6">
                <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block">
                  une vraie histoire
                </p>
                <div className="mt-2 hidden sm:block">
                  <CurvedArrowRight />
                </div>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-[#0A0F1E] mb-6 leading-[1.15] tracking-tight">
                D'où on vient
              </h2>

              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                Avant Tel &amp; Cash, ses fondateurs travaillaient dans de grandes entreprises tech. Bons salaires, belle carrière sur le papier — mais quelque chose manquait. L'envie de construire quelque chose de concret, de vrai, avec leurs mains et leurs convictions.
              </p>
              <p className="text-lg text-slate-500 font-medium leading-relaxed mt-5">
                Ils ont tout quitté pour ouvrir une boutique à Angers. Pas un entrepôt anonyme derrière un écran. Un vrai lieu, une vraie équipe, qui connaît et teste chaque appareil qu'elle vend.
              </p>
            </motion.div>

            {/* Right: photo polaroid */}
            <motion.div
              className="flex justify-center relative mt-10 md:mt-0"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative">
                <div
                  className="w-[300px] h-[340px] md:w-[360px] md:h-[440px] overflow-hidden"
                  style={{
                    borderRadius: '16px',
                    border: '10px solid white',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
                    transform: 'rotate(2deg)',
                  }}
                >
                  <img
                    src="/boutique.jpg"
                    alt="Boutique Tel &amp; Cash Angers"
                    className="w-full h-full object-cover hover:scale-105 transition-all duration-700"
                  />
                </div>
                {/* Badge */}
                <motion.div
                  animate={{ y: [-3, 3, -3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-6 -right-6 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-2xl px-4 py-3 border border-slate-100 flex items-center gap-2.5 z-20"
                >
                  <Sparkle size={16} color="#3b82f6" className="opacity-80" />
                  <div className="flex flex-col">
                    <span className="text-[#0A0F1E] font-black text-sm leading-none">Depuis 2019</span>
                    <span className="text-slate-400 text-[10px] font-semibold tracking-wide">Angers, Maine-et-Loire</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CE QU'ON CROIT ── */}
      <section className="py-24 bg-[#F9F8F5] overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">

          {/* Header */}
          <div className="mb-16 text-center">
            <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-3">
              nos convictions
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-[#0A0F1E] tracking-tight leading-[1.1]">
              On fait les choses différemment.
            </h2>
          </div>

          {/* 3 conviction blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                circleBg: 'bg-blue-100',
                iconPath: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="11" />
                    <line x1="11" y1="14" x2="11.01" y2="14" />
                  </svg>
                ),
                title: "L'expertise avant tout",
                text: "Chaque téléphone passe entre les mains de nos techniciens. 60 points de contrôle stricts, aucune exception, aucun compromis.",
              },
              {
                circleBg: 'bg-emerald-100',
                iconPath: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
                title: "L'humain d'abord",
                text: "Pas de bot, pas de centre d'appels délocalisé. Vous parlez directement à quelqu'un de l'équipe, à Angers.",
              },
              {
                circleBg: 'bg-orange-100',
                iconPath: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                ),
                title: "Le reconditionné responsable",
                text: "Donner une seconde vie aux appareils, c'est bon pour votre budget et pour la planète. On y croit sincèrement.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-5"
              >
                <div className={`w-12 h-12 rounded-full ${item.circleBg} flex items-center justify-center shrink-0`}>
                  {item.iconPath}
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0A0F1E] mb-2">{item.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed text-sm">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHIFFRES CLÉS ── */}
      <section className="py-24 bg-[#0A0F1E] text-white overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#2563EB]/10 blur-[120px] rounded-full pointer-events-none" />

        {/* Decorative dots */}
        <svg className="absolute top-12 left-12 w-20 h-20 opacity-25" viewBox="0 0 100 100">
          <circle cx="10" cy="10" r="2" fill="#3b82f6" />
          <circle cx="30" cy="10" r="2" fill="#3b82f6" />
          <circle cx="50" cy="10" r="2" fill="#3b82f6" />
          <circle cx="10" cy="30" r="2" fill="#3b82f6" />
          <circle cx="10" cy="50" r="2" fill="#3b82f6" />
        </svg>

        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <div className="text-center mb-16">
            <p className="font-['Caveat'] text-[#93c5fd] text-3xl -rotate-2 inline-block mb-3">
              en chiffres
            </p>
            <Sparkle size={18} color="#93c5fd" className="inline-block ml-2 opacity-70 animate-pulse" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { value: '500K', label: 'Clients', sublabel: 'satisfaits' },
              { value: '5/5', label: 'Note', sublabel: 'Google' },
              { value: '+5 ans', label: "d'expérience", sublabel: 'à Angers' },
              { value: '24 mois', label: 'de garantie', sublabel: 'incluse' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="flex flex-col items-center text-center relative"
              >
                <Sparkle
                  size={14}
                  color="#93c5fd"
                  className="absolute -top-3 -right-2 opacity-60"
                />
                <div className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">{stat.value}</div>
                <div className="text-sm font-bold text-[#3b82f6] tracking-wider uppercase">{stat.label}</div>
                <div className="text-xs text-white/50 font-medium mt-1">{stat.sublabel}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOTRE PROMESSE ── */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-16 items-start">

            {/* Left */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
            >
              <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-4">
                notre engagement
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0A0F1E] tracking-tight leading-[1.15]">
                On ne vend pas des téléphones.{' '}
                <br />
                On vous accompagne.
              </h2>
            </motion.div>

            {/* Right */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="pt-2"
            >
              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                De la question "quel modèle choisir&nbsp;?" jusqu'au SAV si besoin — notre équipe est là à chaque étape. Pas de script, pas de pression. Juste des{' '}
                <span className="font-bold text-[#0A0F1E] relative inline-block">
                  conseils honnêtes
                  <svg
                    viewBox="0 0 130 10"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1.5 left-0 w-full h-2.5 fill-none opacity-60"
                    style={{ strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px' }}
                  >
                    <path d="M 0 5 Q 13 0 26 5 T 52 5 T 78 5 T 104 5 T 130 5" />
                  </svg>
                </span>{' '}
                de gens qui connaissent leur métier.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── L'ÉQUIPE ── */}
      <section className="py-24 bg-[#F9F8F5] overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">

          <div className="mb-12 text-center">
            <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-3">
              ceux qui font tout
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-[#0A0F1E] tracking-tight leading-[1.1] mb-3">
              Des passionnés, pas des vendeurs.
            </h2>
            <p className="text-lg text-slate-500 font-medium max-w-lg mx-auto">
              Une petite équipe soudée, basée à Angers, qui met les mains dans le cambouis tous les jours.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { initials: 'YA', role: 'Co-fondateur & Technicien', label: 'Responsable technique' },
              { initials: 'MB', role: 'Co-fondatrice & Accueil', label: 'Relation client' },
              { initials: 'TD', role: 'Technicien senior', label: 'Reconditionnement' },
            ].map((member, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Photo placeholder */}
                <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-50 flex flex-col items-center justify-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-[#3b82f6]/10 border-2 border-[#3b82f6]/20 flex items-center justify-center">
                    <span className="text-2xl font-black text-[#3b82f6]">{member.initials}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Photo à venir</span>
                </div>
                <div className="p-6">
                  <div className="inline-flex items-center gap-1.5 bg-[#3b82f6]/8 text-[#3b82f6] text-[11px] font-bold tracking-wider uppercase rounded-full px-3 py-1 mb-3">
                    {member.label}
                  </div>
                  <p className="text-slate-600 font-medium text-sm">{member.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24 bg-[#F9F8F5] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F9F8F5] to-[#F9F8F5] pointer-events-none" />

        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-[#0A0F1E] tracking-tight mb-4 leading-[1.1]">
              Venez nous voir.
            </h2>
            <p className="text-lg text-slate-500 font-medium mb-10 max-w-xl mx-auto">
              La boutique est ouverte à Angers. On sera ravis de vous accueillir.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
              {/* Sparkle near buttons */}
              <Sparkle size={20} color="#3b82f6" className="absolute -top-6 right-1/2 translate-x-8 opacity-70 hidden sm:block animate-pulse" />

              <a
                href="https://www.google.com/maps/place/Tel+and+Cash+Angers/@47.4734511,-0.5521127,17z"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block border-2 border-[#0A0F1E] text-[#0A0F1E] font-bold text-base px-8 py-3.5 rounded-xl hover:bg-[#0A0F1E] hover:text-white transition-all shadow-sm hover:shadow-xl hover:shadow-slate-900/20 bg-white"
              >
                Nous rendre visite
              </a>

              <Link
                href="/products"
                className="inline-block bg-[#3b82f6] hover:bg-blue-600 text-white font-bold text-base px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5"
              >
                Voir nos smartphones
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

    </main>
  );
}
