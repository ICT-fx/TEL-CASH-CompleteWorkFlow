import Link from 'next/link';
import { GRADE_BATTERY_MIN } from '@/lib/grades';

// « Un smartphone reconditionné, c'est quoi exactement ? » — refonte v4.
// Structure conservée (accroche Caveat, H2, texte, 4 cartes, photo, bouton
// « En savoir plus » → /reconditionnement). Badge « Garanti ! » (plus jamais
// « Comme neuf », décret 2022-190). Sur ordinateur seulement : « Choisissez
// votre état » (3 cartes). Pas d'animation floue au scroll.

// États (SPEC 08/10/2026). Batterie minimum garantie : source unique
// GRADE_BATTERY_MIN (src/lib/grades.ts). Plus de prix en dur ici : ils
// pourraient contredire les prix réels du catalogue.
const STATES = [
  { letter: 'A', label: 'Parfait état', look: 'Aucune trace', battery: GRADE_BATTERY_MIN.A, tone: 'navy' },
  { letter: 'B', label: 'Très bon état', look: 'Micro-rayures', battery: GRADE_BATTERY_MIN.B, tone: 'blue' },
  { letter: 'C', label: 'État correct', look: 'Traces visibles', battery: GRADE_BATTERY_MIN.C, tone: 'white' },
] as const;

const TONE_CLASS: Record<(typeof STATES)[number]['tone'], string> = {
  navy: 'text-white bg-[linear-gradient(180deg,#26325C,#0A0F1E)] shadow-[inset_0_1px_0_rgba(255,255,255,.2)]',
  blue: 'text-[#2457E6] bg-[linear-gradient(180deg,#F1F5FF,#DCE6FF)]',
  white: 'text-[#0A0F1E] bg-[linear-gradient(180deg,#FFFFFF,#EEF1F6)] border border-[#E1E5EE]',
};

const shieldPath = (
  <>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </>
);

const FEATURES = [
  {
    title: '+60 points',
    sub: 'de contrôle stricts',
    stroke: '#2457E6',
    icon: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5Z" />,
  },
  {
    title: 'Batterie',
    sub: 'minimum 85 % garanti',
    stroke: '#16A34A',
    icon: (
      <>
        <rect x="2" y="7" width="17" height="10" rx="2" />
        <path d="M22 11v2" />
        <path d="M5 10h7v4H5z" fill="#16A34A" />
      </>
    ),
  },
  {
    title: 'Retour 30 j',
    sub: 'Satisfait ou remboursé',
    stroke: '#2457E6',
    icon: (
      <>
        <path d="M20 11a8 8 0 0 0-14.9-3" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14.9 3" />
        <path d="M20 20v-4h-4" />
      </>
    ),
  },
  { title: 'Garantie 24 mois', sub: 'Sérénité totale incluse', stroke: '#E0A100', icon: shieldPath },
];

function GarantiBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`tc-glass flex items-center gap-2.5 md:gap-3 rounded-2xl md:rounded-[18px] px-3.5 py-2.5 md:px-[18px] md:py-3.5 ${className}`}>
      <span className="w-[34px] h-[34px] md:w-10 md:h-10 rounded-full flex items-center justify-center text-[#2457E6] bg-[linear-gradient(180deg,#F1F5FF,#DCE6FF)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {shieldPath}
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="font-caveat font-bold text-[#2457E6] text-[19px] md:text-[22px] leading-none">Garanti !</span>
        <b className="text-[13px] md:text-[15px] text-[#0A0F1E]">100 % fonctionnel</b>
      </span>
    </div>
  );
}

export function WhyRefurbished() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1232px] px-4 py-9 md:pt-24 md:pb-14 grid grid-cols-1 md:grid-cols-2 gap-[18px] md:gap-12 lg:gap-[72px] items-center">
        {/* Colonne texte */}
        <div className="flex flex-col gap-[18px] md:gap-[22px] min-w-0">
          <div className="flex flex-col gap-1 md:gap-[22px]">
            <span className="self-start font-caveat font-bold text-[#2457E6] text-[23px] md:text-[28px] -rotate-2 inline-block">
              on vous explique tout
            </span>
            {/* Mobile : titre court sur 2 lignes maximum (demande Yanis 10/10). Ordinateur : titre complet. */}
            <h2 className="m-0 text-[30px] leading-[1.1] md:text-[40px] lg:text-[50px] md:leading-[1.04] font-extrabold md:font-black tracking-[-.03em] md:tracking-[-.04em] text-[#0A0F1E] [text-wrap:balance]">
              <span className="md:hidden">Le reconditionné,<br />c&apos;est quoi&nbsp;?</span>
              <span className="hidden md:inline">Un smartphone reconditionné, c&apos;est quoi exactement&nbsp;?</span>
            </h2>
          </div>
          <p className="m-0 text-[15px] md:text-lg leading-[1.55] md:leading-[1.6] text-[#47506A]">
            Un téléphone collecté, diagnostiqué, réparé si nécessaire, puis testé sur plus de 60 points de contrôle par nos
            techniciens<span className="hidden md:inline"> passionnés</span>.
          </p>

          {/* Mobile : photo entre le texte et les cartes */}
          <div className="md:hidden relative pt-1.5 px-1.5 pb-[26px]">
            <img
              src="/smartphone-reconditionne.jpg"
              alt="Smartphone reconditionné tenu en main"
              loading="lazy"
              decoding="async"
              className="block w-full h-[220px] object-cover rounded-[22px] -rotate-[1.5deg] shadow-[0_22px_40px_-22px_rgba(11,20,55,.55),0_0_0_6px_#fff]"
            />
            <GarantiBadge className="absolute right-0 bottom-0" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="relative overflow-hidden flex flex-col gap-1.5 rounded-[18px] md:rounded-[20px] p-4 md:px-[22px] md:py-5 border border-[#ECEEF3] shadow-[0_10px_22px_-18px_rgba(11,20,55,.4)] md:shadow-[0_12px_26px_-20px_rgba(11,20,55,.45)] bg-[linear-gradient(180deg,#fff,#FBFBFD)]"
              >
                <span aria-hidden="true" className="absolute -right-[26px] -top-[26px] w-20 h-20 md:-right-[30px] md:-top-[30px] md:w-[100px] md:h-[100px] rounded-full bg-[#F2F6FF]" />
                <svg className="relative w-[22px] h-[22px] md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke={f.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {f.icon}
                </svg>
                <b className="relative text-base md:text-lg text-[#0A0F1E]">{f.title}</b>
                <span className="relative text-[13px] md:text-sm text-[#5B6478]">{f.sub}</span>
              </div>
            ))}
          </div>

          <Link href="/reconditionnement" className="tc-btn-navy self-start md:min-h-[54px] md:px-[26px]">
            En savoir plus
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        {/* Ordinateur : visuel (cercle pointillé + loupe + photo + badge) */}
        <div className="hidden md:block relative h-[560px] w-full max-w-[580px] mx-auto">
          <div aria-hidden="true" className="absolute left-[40px] top-[30px] w-[500px] h-[500px] max-w-[calc(100%-40px)] rounded-full border-2 border-dashed border-[#C9D6F5]" />
          <div aria-hidden="true" className="absolute left-[10px] top-0 w-[560px] h-[560px] max-w-full rounded-full" style={{ background: 'radial-gradient(closest-side,rgba(74,123,255,.12),rgba(74,123,255,0))' }} />
          <img
            src="/smartphone-reconditionne.jpg"
            alt="Smartphone reconditionné tenu en main"
            loading="lazy"
            decoding="async"
            className="absolute left-[90px] top-[60px] w-[400px] max-w-[calc(100%-110px)] h-[460px] object-cover rounded-[26px] rotate-2 shadow-[0_30px_60px_-28px_rgba(11,20,55,.6),0_0_0_8px_#fff]"
          />
          <span aria-hidden="true" className="tc-glass absolute left-5 top-[84px] w-[58px] h-[58px] rounded-full flex items-center justify-center text-[#2457E6]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
              <path d="M11 8v3.5" />
              <circle cx="11" cy="14" r=".6" fill="currentColor" />
            </svg>
          </span>
          <GarantiBadge className="absolute right-0 bottom-14" />
        </div>
      </div>

      {/* Ordinateur seulement : choisissez votre état */}
      <div className="hidden md:flex mx-auto max-w-[1232px] px-4 pb-24 flex-col gap-[18px]">
        <h3 className="m-0 text-[22px] font-bold tracking-[-.02em] text-[#0A0F1E]">Choisissez votre état</h3>
        <div className="grid grid-cols-3 gap-4 lg:gap-5">
          {STATES.map((s) => (
            <div
              key={s.letter}
              className="flex items-center gap-3.5 rounded-[20px] border border-[#E7E9EF] px-4 lg:px-[22px] py-5 bg-[linear-gradient(180deg,#fff,#FAFBFD)] shadow-[0_12px_26px_-22px_rgba(11,20,55,.5)]"
            >
              <span className={`w-[46px] h-[46px] shrink-0 rounded-[14px] flex items-center justify-center font-extrabold text-[19px] ${TONE_CLASS[s.tone]}`} aria-hidden="true">
                {s.letter}
              </span>
              <div className="flex-1 min-w-0">
                <b className="text-[17px] text-[#0A0F1E]">{s.label}</b>
                <div className="text-sm text-[#5B6478]">
                  {s.look}
                  <br />
                  Batterie ≥ {s.battery} %
                </div>
              </div>
              <div className="text-right shrink-0 text-[13px] font-semibold text-[#5B6478] leading-snug">
                Garantie
                <br />
                <b className="text-[15px] text-[#0A0F1E]">24 mois</b>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
