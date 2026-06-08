// Étape 4 (v3) — « Les 3 états expliqués » premium : script agrandi, médaillon
// carré (monochrome → bleu si sélectionné), une icône par ligne, beaucoup d'air.
// Fond blanc. Garde les noms Comme neuf / Très bon état / État correct.

'use client';

import { Eye, BatteryFull, BatteryMedium, BatteryLow, ShieldCheck, type LucideIcon } from 'lucide-react';
import { normalizeGrade } from '@/lib/products';

interface GradeCopy {
  letter: 'A' | 'B' | 'C';
  name: string;
  sub: string;
  aspect: string;
  battery: string;
  batIcon: LucideIcon;
}

const COPY: GradeCopy[] = [
  { letter: 'A', name: 'Comme neuf',    sub: 'Aucune trace',    aspect: 'Impeccable',      battery: '≥ 100 %', batIcon: BatteryFull },
  { letter: 'B', name: 'Très bon état', sub: 'Micro-rayures',   aspect: 'Légères traces',  battery: '≥ 92 %',  batIcon: BatteryMedium },
  { letter: 'C', name: 'État correct',  sub: 'Traces visibles', aspect: 'Traces visibles', battery: '≥ 85 %',  batIcon: BatteryLow },
];

interface Props {
  selectedGrade: string | null;
}

export function GradeExplainer({ selectedGrade }: Props) {
  // Explainer par familles A/B/C : un grade «+» (ex. C+) allume sa famille (C).
  const selected = normalizeGrade(selectedGrade)?.replace('+', '') ?? null;

  return (
    <section>
      <div className="mb-1.5">
        <h2 className="text-2xl font-extrabold text-[#0B1437] inline">Les 3 états expliqués</h2>
        <span className="font-['Caveat'] text-[#4B7BFF] text-[30px] ml-3 align-baseline">en un coup d&apos;œil</span>
      </div>
      <div className="h-px bg-[#ECECEC] my-5" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {COPY.map((g) => {
          const isSel = selected === g.letter;
          const Bat = g.batIcon;
          return (
            <div
              key={g.letter}
              className={`rounded-[18px] border p-5 pb-2.5 transition-all ${
                isSel ? 'border-2 border-[#2F6BFF] bg-[#F7F9FF] shadow-[0_16px_34px_-24px_rgba(47,107,255,0.5)]' : 'border-[1.5px] border-[#E8E8E8] bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={`w-10 h-10 rounded-xl text-[17px] font-extrabold flex items-center justify-center flex-none ${
                    isSel ? 'bg-[#2F6BFF] text-white' : 'bg-[#F1F3F8] text-[#0B1437]'
                  }`}
                >
                  {g.letter}
                </span>
                <div>
                  <p className="text-[15px] font-extrabold text-[#0B1437] leading-none">{g.name}</p>
                  <p className="text-[11px] text-[#9AA3B2] mt-0.5">{g.sub}</p>
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
    <div className="flex items-center justify-between py-3 border-t border-[#F1F1F1]">
      <span className="flex items-center gap-2.5 text-[13px] text-[#8A92A0]">
        <span className="w-7 h-7 rounded-[9px] bg-[#F4F6FA] text-[#2F6BFF] flex items-center justify-center flex-none">
          <Icon className="w-[15px] h-[15px]" strokeWidth={2} />
        </span>
        {label}
      </span>
      <span className="text-[13px] font-extrabold text-[#0B1437]">{value}</span>
    </div>
  );
}
