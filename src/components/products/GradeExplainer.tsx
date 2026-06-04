// Encart "L'état Grade X expliqué" sous les sélecteurs.
// Reprend la même catégorisation que la section Grades de la home (Grades.tsx)
// : nom, phrase courte, 3 indicateurs aspect / batterie / garantie.

'use client';

import { Eye, Battery, ShieldCheck } from 'lucide-react';
import { normalizeGradeLetter } from '@/lib/products';

interface GradeCopy {
  letter: 'A' | 'B' | 'C';
  name: string;
  sentence: string;
  aspect: string;
  battery: string;
  warranty: string;
  letterBg: string;
  letterColor: string;
  borderClass: string;
}

const COPY: Record<'A' | 'B' | 'C', GradeCopy> = {
  A: {
    letter: 'A',
    name: 'Comme neuf',
    sentence:
      "Aucune marque d'usure visible — l'expérience du neuf. Idéal si vous voulez un appareil impeccable sans payer le prix du neuf.",
    aspect: 'Comme neuf',
    battery: '100 %',
    warranty: '24 mois',
    letterBg: 'bg-blue-50',
    letterColor: 'text-blue-600',
    borderClass: 'border-blue-200',
  },
  B: {
    letter: 'B',
    name: 'Très bon état',
    sentence:
      'De très légères micro-rayures, invisibles à bout de bras. Excellent compromis qualité-prix.',
    aspect: 'Légères traces',
    battery: '≥ 90 %',
    warranty: '24 mois',
    letterBg: 'bg-emerald-50',
    letterColor: 'text-emerald-600',
    borderClass: 'border-emerald-200',
  },
  C: {
    letter: 'C',
    name: 'État correct',
    sentence:
      "Des traces d'usage assumées (rayures visibles, micro-impacts). Pour le plus petit budget — performances identiques.",
    aspect: 'Traces visibles',
    battery: '≥ 85 %',
    warranty: '24 mois',
    letterBg: 'bg-amber-50',
    letterColor: 'text-amber-600',
    borderClass: 'border-amber-200',
  },
};

interface Props {
  selectedGrade: string | null;
}

export function GradeExplainer({ selectedGrade }: Props) {
  // Le sélecteur stocke la lettre A/B/C dans selectedGrade ; mais la base
  // contient les libellés FR — normaliser des deux côtés pour éviter les bugs
  // si un fallback envoyait "Parfait État" directement ici.
  const letter = normalizeGradeLetter(selectedGrade);
  if (!letter) return null;

  const g = COPY[letter];

  return (
    <div className={`bg-white border ${g.borderClass} rounded-2xl p-5 md:p-6`}>
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-2xl ${g.letterBg} flex items-center justify-center flex-shrink-0`}>
          <span className={`text-2xl font-black ${g.letterColor}`}>{g.letter}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
            L'état Grade {g.letter} expliqué
          </p>
          <h3 className="text-lg font-black text-[#0A0F1E] leading-tight">{g.name}</h3>
        </div>
      </div>

      <p className="text-sm text-slate-600 font-medium leading-relaxed mb-5">
        {g.sentence}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-4 border-t border-slate-100">
        <Indicator icon={<Eye className="w-4 h-4" />} label="Aspect" value={g.aspect} />
        <Indicator icon={<Battery className="w-4 h-4" />} label="Batterie" value={g.battery} />
        <Indicator icon={<ShieldCheck className="w-4 h-4" />} label="Garantie" value={g.warranty} />
      </div>
    </div>
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
