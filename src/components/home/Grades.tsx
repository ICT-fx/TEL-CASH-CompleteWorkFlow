'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, Battery, ShieldCheck, ArrowRight } from 'lucide-react';

interface GradeCard {
  letter: 'A' | 'B' | 'C';
  name: string;
  sentence: string;
  aspect: string;
  warranty: string;
  popular?: boolean;
  letterBg: string;
  letterColor: string;
  borderClass: string;
}

// Charte : pas de pastilles de grade colorées — lettres en navy sur fond
// neutre, la hiérarchie est portée par la bordure et le badge "populaire".
const GRADES: GradeCard[] = [
  {
    letter: 'A',
    name: 'Comme neuf',
    sentence: "Aucune marque d'usure visible — l'expérience du neuf.",
    aspect: 'Comme neuf',
    warranty: '24 mois',
    popular: true,
    letterBg: 'bg-slate-100',
    letterColor: 'text-[#0B1437]',
    borderClass: 'border-2 border-blue-500',
  },
  {
    letter: 'B',
    name: 'Très bon état',
    sentence: 'De très légères micro-rayures, invisibles à bout de bras.',
    aspect: 'Légères traces',
    warranty: '12 mois',
    letterBg: 'bg-slate-100',
    letterColor: 'text-[#0B1437]',
    borderClass: 'border border-slate-200',
  },
  {
    letter: 'C',
    name: 'État correct',
    sentence: "Des traces d'usage assumées, pour le plus petit budget.",
    aspect: 'Traces visibles',
    warranty: '12 mois',
    letterBg: 'bg-slate-100',
    letterColor: 'text-[#0B1437]',
    borderClass: 'border border-slate-200',
  },
];

export function Grades() {
  return (
    <section className="py-16 md:py-24 bg-[#F9F8F5]">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-black tracking-tight text-[#0A0F1E] mb-4"
          >
            Nos grades de qualité
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-base md:text-lg text-slate-500 max-w-xl mx-auto font-medium"
          >
            Le même téléphone, à vous de choisir l'aspect — performance garantie à 100 %.
          </motion.p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {GRADES.map((g, i) => (
            <motion.div
              key={g.letter}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-white rounded-3xl ${g.borderClass} p-6 flex flex-col`}
            >
              {g.popular && (
                <span className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-wide">
                  Le plus populaire
                </span>
              )}

              {/* Letter + name */}
              <div className="flex items-center gap-3 mb-3 mt-1">
                <div className={`w-12 h-12 rounded-2xl ${g.letterBg} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-2xl font-black ${g.letterColor}`}>{g.letter}</span>
                </div>
                <h3 className="text-lg font-bold text-[#0A0F1E]">{g.name}</h3>
              </div>

              {/* One sentence */}
              <p className="text-sm text-slate-500 font-medium leading-relaxed mb-5">
                {g.sentence}
              </p>

              {/* 3 indicators */}
              <div className="mt-auto flex flex-col gap-2.5 pt-4 border-t border-slate-100">
                <Indicator icon={<Eye className="w-4 h-4" />} label="Aspect" value={g.aspect} />
                <Indicator icon={<Battery className="w-4 h-4" />} label="Batterie" value="≥ 85 %" />
                <Indicator icon={<ShieldCheck className="w-4 h-4" />} label="Garantie" value={g.warranty} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Discreet link */}
        <div className="text-center mt-10">
          <Link
            href="/reconditionnement"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#3b82f6] transition-colors"
          >
            Comprendre nos grades
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Indicator({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span className="text-slate-500 font-medium">{label}</span>
      <span className="ml-auto font-bold text-[#0A0F1E]">{value}</span>
    </div>
  );
}
