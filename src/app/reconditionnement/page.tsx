'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Search, Wrench, CheckCircle2, ShieldCheck, RotateCcw, Battery, Camera, Smartphone, Wifi, Volume2, Cpu } from 'lucide-react';

/* ─────────────────────── SVG helpers (cohérence "Qui sommes-nous") ─────────────────────── */

const Sparkle = ({ className = '', size = 20, color = '#3b82f6' }: { className?: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={`fill-none stroke-[1.5px] ${className}`} style={{ stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
  </svg>
);

const WavyUnderline = ({ color = '#3b82f6' }: { color?: string }) => (
  <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-60" style={{ strokeLinecap: 'round', stroke: color, strokeWidth: '1.5px' }}>
    <path d="M 0 6 Q 20 0 40 6 T 80 6 T 120 6 T 160 6 T 200 6" />
  </svg>
);

/* ─────────────────────── Data ─────────────────────── */

const STEPS = [
  { icon: Search, title: 'Collecté & trié', text: "Chaque appareil est récupéré puis trié selon son potentiel de remise en état." },
  { icon: Cpu, title: 'Diagnostiqué', text: "Un diagnostic complet identifie chaque composant à vérifier ou remplacer." },
  { icon: Wrench, title: 'Réparé', text: "Les pièces défectueuses sont remplacées, la batterie vérifiée et nettoyée." },
  { icon: CheckCircle2, title: 'Testé & certifié', text: "Plus de 60 points de contrôle avant la mise en vente — aucune exception." },
];

const CHECKS = [
  { icon: Smartphone, label: 'Écran & tactile' },
  { icon: Battery, label: 'Santé batterie' },
  { icon: Camera, label: 'Appareils photo' },
  { icon: Volume2, label: 'Haut-parleurs & micro' },
  { icon: Wifi, label: 'Réseau, Wi-Fi & Bluetooth' },
  { icon: Cpu, label: 'Capteurs & connectique' },
];

const GRADES = [
  {
    letter: 'A', name: 'Comme neuf', warranty: '24 mois',
    text: "Aucune marque d'usure visible. L'appareil est esthétiquement irréprochable — l'expérience du neuf, sans le prix du neuf.",
    bg: 'bg-blue-50', color: 'text-blue-600', ring: 'border-2 border-blue-500',
  },
  {
    letter: 'B', name: 'Très bon état', warranty: '12 mois',
    text: "De très légères micro-rayures, invisibles à bout de bras. Le meilleur compromis entre aspect et budget.",
    bg: 'bg-emerald-50', color: 'text-emerald-600', ring: 'border border-slate-200',
  },
  {
    letter: 'C', name: 'État correct', warranty: '12 mois',
    text: "Des traces d'usage visibles et assumées. Performances identiques, pour le plus petit budget.",
    bg: 'bg-amber-50', color: 'text-amber-600', ring: 'border border-slate-200',
  },
];

/* ─────────────────────── Page ─────────────────────── */

export default function ReconditionnementPage() {
  return (
    <main>
      {/* ── HERO ── */}
      <section className="py-28 bg-[#F9F8F5] overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/4" />
        <div className="container mx-auto px-4 max-w-4xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="mb-4 flex items-center justify-center gap-2"
          >
            <span className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block">on vous explique tout</span>
            <Sparkle size={18} className="opacity-70 animate-pulse" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl font-black tracking-tight text-[#0A0F1E] mb-6 leading-[1.1]"
          >
            Le reconditionné,<br />
            <span className="text-[#3b82f6] relative inline-block">expliqué simplement.<WavyUnderline /></span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Un téléphone reconditionné n'est pas un téléphone d'occasion. C'est un appareil remis à neuf, testé et garanti par nos techniciens.
          </motion.p>
        </div>
      </section>

      {/* ── C'EST QUOI ── */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-3">la différence</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0F1E] mb-6 tracking-tight leading-[1.15]">
            Reconditionné ≠ occasion
          </h2>
          <p className="text-lg text-slate-500 font-medium leading-relaxed">
            Un produit d'occasion est revendu en l'état. Un produit reconditionné, lui, passe entre les mains de nos techniciens&nbsp;: il est diagnostiqué, réparé si nécessaire, nettoyé, puis testé sur plus de 60 points de contrôle. Il repart avec une garantie et un droit de retour. Vous payez le juste prix, sans le risque.
          </p>
        </div>
      </section>

      {/* ── LES ÉTAPES ── */}
      <section className="py-24 bg-[#F9F8F5] overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-16 text-center">
            <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-3">étape par étape</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#0A0F1E] tracking-tight leading-[1.1]">
              Le parcours d'un appareil
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col gap-4 relative"
              >
                <span className="absolute top-6 right-7 text-5xl font-black text-slate-100">{i + 1}</span>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <step.icon className="w-6 h-6 text-[#3b82f6]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0A0F1E] mb-2">{step.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed text-sm">{step.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 60 POINTS DE CONTRÔLE ── */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-4">aucun compromis</p>
              <h2 className="text-3xl md:text-4xl font-black text-[#0A0F1E] mb-6 leading-[1.15] tracking-tight">
                Plus de 60 points de contrôle
              </h2>
              <p className="text-lg text-slate-500 font-medium leading-relaxed mb-4">
                Avant qu'un téléphone ne rejoigne notre catalogue, chaque fonction est testée individuellement. S'il ne passe pas un seul test, il ne part pas en vente.
              </p>
              <p className="text-lg text-slate-500 font-medium leading-relaxed">
                La batterie est systématiquement vérifiée et certifiée à <span className="font-bold text-[#0A0F1E]">85 % de capacité minimum</span>.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="grid grid-cols-2 gap-4"
            >
              {CHECKS.map((c) => (
                <div key={c.label} className="bg-[#F9F8F5] rounded-2xl p-5 border border-slate-100 flex items-center gap-3">
                  <c.icon className="w-5 h-5 text-[#3b82f6] shrink-0" />
                  <span className="text-sm font-bold text-[#0A0F1E]">{c.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── LES GRADES ── */}
      <section className="py-24 bg-[#F9F8F5] overflow-hidden">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="mb-14 text-center">
            <p className="font-['Caveat'] text-[#3b82f6] text-3xl -rotate-2 inline-block mb-3">à vous de choisir</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#0A0F1E] tracking-tight leading-[1.1] mb-4">
              Nos 3 grades de qualité
            </h2>
            <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto">
              La performance technique est garantie à 100 % quel que soit le grade. Seul l'aspect esthétique change.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {GRADES.map((g, i) => (
              <motion.div
                key={g.letter}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`relative bg-white rounded-3xl ${g.ring} p-6 flex flex-col`}
              >
                {g.letter === 'A' && (
                  <span className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wide">
                    Le plus populaire
                  </span>
                )}
                <div className="flex items-center gap-3 mb-3 mt-1">
                  <div className={`w-12 h-12 rounded-2xl ${g.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-2xl font-black ${g.color}`}>{g.letter}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0A0F1E]">{g.name}</h3>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-4">{g.text}</p>
                <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-100 text-sm">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500 font-medium">Garantie</span>
                  <span className="ml-auto font-bold text-[#0A0F1E]">{g.warranty}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GARANTIE & RETOUR ── */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-[#F9F8F5] rounded-3xl p-10 border border-slate-100 flex flex-col gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#3b82f6]" />
              </div>
              <h3 className="text-2xl font-black text-[#0A0F1E]">Garantie jusqu'à 24 mois</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Chaque appareil est couvert par une garantie incluse — 24 mois sur le grade « Comme neuf », 12 mois sur les autres. En cas de souci, notre équipe à Angers s'en occupe.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-[#F9F8F5] rounded-3xl p-10 border border-slate-100 flex flex-col gap-4"
            >
              {/* Vert = contexte économies/satisfait-remboursé (charte). */}
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-[#0E7A52]" />
              </div>
              <h3 className="text-2xl font-black text-[#0A0F1E]">Retour sous 30 jours</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Vous changez d'avis ? Vous disposez de 30 jours pour nous retourner votre appareil et être remboursé. Satisfait ou remboursé, sans discussion.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-24 bg-[#F9F8F5] overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F9F8F5] to-[#F9F8F5] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-[#0A0F1E] tracking-tight mb-4 leading-[1.1]">
              Prêt à franchir le pas ?
            </h2>
            <p className="text-lg text-slate-500 font-medium mb-10 max-w-xl mx-auto">
              Découvrez nos smartphones reconditionnés, testés et garantis.
            </p>
            <Link
              href="/products"
              className="inline-block bg-[#3b82f6] hover:bg-blue-600 text-white font-bold text-base px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5"
            >
              Voir nos smartphones
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
