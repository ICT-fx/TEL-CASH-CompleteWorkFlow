// « Quel état choisir ? » (refonte v4, maquettes Fiche-mobile / Fiche-ordi).
// Mobile : liste de cartes horizontales. Ordinateur : 3 colonnes.
// Badge « Notre conseil » fixe sur Parfait état, « Le moins cher » sur État
// correct. La carte du grade sélectionné est surlignée ; un clic sélectionne
// le grade (synchronisé avec le sélecteur du haut de fiche).
// Libellés + batteries : src/lib/grades.ts (jamais « Comme neuf », décret 2022-190).

'use client';

import { displayGrade, type DisplayGrade } from '@/lib/products';
import { CLIENT_GRADES, gradeBatteryLabel } from '@/lib/grades';

export interface GradeExplainerOption {
  letter: DisplayGrade;
  /** Prix affiché pour ce grade (configuration courante), null = pas de prix. */
  price: number | null;
  /** Non sélectionnable dans le contexte courant (aucun prix défini). */
  disabled?: boolean;
}

interface Props {
  selectedGrade: string | null;
  /** Grades proposés pour ce modèle. Absent → les 3 grades, sans prix. */
  options?: GradeExplainerOption[];
  onSelectGrade?: (grade: DisplayGrade) => void;
}

const MEDAL: Record<DisplayGrade, string> = {
  A: 'bg-[linear-gradient(180deg,#26325C,#0A0F1E)] text-white',
  B: 'bg-[linear-gradient(180deg,#F1F5FF,#DCE6FF)] text-[#2457E6]',
  C: 'bg-[linear-gradient(180deg,#FFFFFF,#EEF1F6)] text-[#0A0F1E] border border-[#E7E9EF]',
};

export function GradeExplainer({ selectedGrade, options, onSelectGrade }: Props) {
  const selected = displayGrade(selectedGrade);
  const byLetter = new Map((options ?? []).map((o) => [o.letter, o]));
  const grades = options ? CLIENT_GRADES.filter((g) => byLetter.has(g.letter)) : CLIENT_GRADES;
  if (grades.length === 0) return null;

  return (
    <section id="etats" aria-labelledby="etats-titre" className="scroll-mt-24">
      <h2 id="etats-titre" className="text-[22px] md:text-[28px] font-extrabold tracking-[-0.02em] text-[#0A0F1E]">
        Quel état choisir ?
      </h2>
      <p className="mt-1 text-[14px] md:text-[15px] leading-relaxed text-[#47506A]">
        Même téléphone, mêmes tests, même garantie 24 mois. Seul l&apos;aspect change.
      </p>

      <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-4">
        {grades.map((g) => {
          const opt = byLetter.get(g.letter);
          const isSel = selected === g.letter;
          const disabled = !!opt?.disabled;
          const clickable = !!onSelectGrade && !disabled;
          const price = opt?.price ?? null;

          const badge =
            g.letter === 'A' ? (
              <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[12px] font-bold text-white bg-[linear-gradient(180deg,#4A7BFF,#1C46C9)] shadow-[inset_0_1px_0_rgba(255,255,255,.4)]">
                Notre conseil
              </span>
            ) : g.letter === 'C' ? (
              <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[12px] font-bold text-[#47506A] bg-[#EEF1F6]">
                Le moins cher
              </span>
            ) : null;

          return (
            <button
              key={g.letter}
              type="button"
              onClick={clickable ? () => onSelectGrade!(g.letter) : undefined}
              disabled={!clickable}
              aria-pressed={onSelectGrade ? isSel : undefined}
              className={`w-full text-left rounded-[18px] p-3.5 md:p-5 transition-colors disabled:cursor-default ${
                isSel
                  ? 'border-2 border-[#2457E6] bg-[linear-gradient(180deg,#FAFBFF,#EEF3FF)]'
                  : 'border border-[#E7E9EF] bg-white hover:border-[#C9D3E6]'
              } shadow-[0_10px_22px_-18px_rgba(11,20,55,.45)] ${disabled ? 'opacity-50' : ''}`}
            >
              {/* Mobile : ligne médaillon | texte | prix */}
              <div className="flex items-center gap-3 md:hidden">
                <span className={`w-[42px] h-[42px] flex-none rounded-[13px] font-extrabold text-[17px] flex items-center justify-center ${MEDAL[g.letter]}`}>
                  {g.letter}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <b className="text-[15px] text-[#0A0F1E]">{g.label}</b>
                    {badge}
                  </span>
                  <span className="text-[14px] leading-snug text-[#47506A]">{g.sub}</span>
                  <span className="text-[13px] font-semibold text-[#5B6478]">{gradeBatteryLabel(g.letter)}</span>
                </span>
                {price != null && (
                  <b className="text-[18px] tracking-[-0.02em] text-[#0A0F1E] whitespace-nowrap">{price.toFixed(0)} €</b>
                )}
              </div>

              {/* Ordinateur : carte verticale */}
              <div className="hidden md:flex flex-col h-full">
                <div className="flex items-start justify-between gap-2">
                  <span className={`w-[42px] h-[42px] flex-none rounded-[13px] font-extrabold text-[17px] flex items-center justify-center ${MEDAL[g.letter]}`}>
                    {g.letter}
                  </span>
                  {badge}
                </div>
                <b className="mt-4 text-[18px] text-[#0A0F1E]">{g.label}</b>
                <span className="mt-1 text-[14px] leading-snug text-[#47506A]">{g.sub}</span>
                <span className="mt-auto pt-6 flex items-end justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#5B6478]">{gradeBatteryLabel(g.letter)}</span>
                  {price != null && (
                    <b className="text-[22px] tracking-[-0.02em] text-[#0A0F1E] whitespace-nowrap">{price.toFixed(0)} €</b>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
