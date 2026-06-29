// Étape 4 (v3) — « Les 3 états expliqués » premium : script agrandi, médaillon
// carré (monochrome → bleu si sélectionné), une icône par ligne, beaucoup d'air.
// Fond blanc. Garde les noms Comme neuf / Très bon état / État correct.

'use client';

import { Eye, BatteryFull, BatteryMedium, BatteryLow, ShieldCheck, type LucideIcon } from 'lucide-react';
import { displayGrade, type DisplayGrade } from '@/lib/products';

interface GradeCopy {
  letter: DisplayGrade;
  badge: string;
  name: string;
  sub: string;
  aspect: string;
  battery: string;
  batIcon: LucideIcon;
}

const COPY: GradeCopy[] = [
  { letter: 'A', badge: 'A', name: 'Comme neuf',    sub: "Aucune trace d'usure", aspect: 'Comme neuf',      battery: '≈ 100 %', batIcon: BatteryFull },
  { letter: 'B', badge: 'B', name: 'Très bon état', sub: 'Micro-rayures',        aspect: 'Légères traces',  battery: '≥ 92 %',  batIcon: BatteryMedium },
  { letter: 'C', badge: 'C', name: 'État correct',  sub: 'Traces visibles',      aspect: 'Traces visibles', battery: '≥ 85 %',  batIcon: BatteryLow },
];

interface Props {
  selectedGrade: string | null;
}

export function GradeExplainer({ selectedGrade }: Props) {
  // Explainer par familles A/B/C : tout sous-grade (A+, C+…) allume sa famille.
  const selected = displayGrade(selectedGrade) ?? null;

  return (
    <section>
      <div className="mb-1.5">
        <h2 className="text-2xl font-extrabold text-[#0B1437] inline">Les 3 états expliqués</h2>
        <span className="font-caveat text-[#4B7BFF] text-[30px] ml-3 align-baseline">en un coup d&apos;œil</span>
      </div>
      <div className="h-px bg-[#ECECEC] my-5" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3.5">
        {COPY.map((g) => {
          const isSel = selected === g.letter;
          const Bat = g.batIcon;
          return (
            <div
              key={g.letter}
              className={`rounded-[18px] border p-3 pb-2 sm:p-5 sm:pb-2.5 transition-all ${
                isSel ? 'border-2 border-[#2F6BFF] bg-[#F7F9FF] shadow-[0_16px_34px_-24px_rgba(47,107,255,0.5)]' : 'border-[1.5px] border-[#E8E8E8] bg-white'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-2.5 sm:mb-4">
                <span
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl text-[14px] sm:text-[17px] font-extrabold flex items-center justify-center flex-none ${
                    isSel ? 'bg-[#2F6BFF] text-white' : 'bg-[#F1F3F8] text-[#0B1437]'
                  }`}
                >
                  {g.badge}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] sm:text-[15px] font-extrabold text-[#0B1437] leading-none">{g.name}</p>
                  <p className="text-[10px] sm:text-[11px] text-[#9AA3B2] mt-0.5 leading-tight">{g.sub}</p>
                </div>
              </div>

              <Row icon={Eye} label="Aspect" value={g.aspect} />
              <Row icon={Bat} label="Batterie" value={g.battery} />
              <Row icon={ShieldCheck} label="Garantie" value="24 mois" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 sm:py-3 border-t border-[#F1F1F1]">
      <span className="flex items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-[13px] text-[#8A92A0]">
        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-[9px] bg-[#F4F6FA] text-[#2F6BFF] flex items-center justify-center flex-none">
          <Icon className="w-[13px] h-[13px] sm:w-[15px] sm:h-[15px]" strokeWidth={2} />
        </span>
        {label}
      </span>
      <span className="text-[12px] sm:text-[13px] font-extrabold text-[#0B1437]">{value}</span>
    </div>
  );
}
