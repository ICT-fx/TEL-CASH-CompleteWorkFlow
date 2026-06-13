// Étape 3 (v3) — Sélecteur d'état VISUEL coque/écran, RÉINTRODUIT en version
// réaliste PORTRAIT (téléphone entier, finition titane, lentilles avec relief,
// écran Dynamic Island + reflets, rayures crédibles selon le grade).
//
// Toggle Coque/Écran géré en JS (rendu conditionnel React → aucun chevauchement
// CSS [data-view]). Illustrations de prototype : props `imageCoque`/`imageEcran`
// prêtes à recevoir de vraies photos macro plus tard (remplacent le SVG).

'use client';

import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { displayGrade, DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';

type Letter = DisplayGrade;
type St = 'a' | 'b' | 'c'; // niveau d'usure de l'illustration (le «+» partage la base)
type View = 'coque' | 'ecran';

export interface VisualGradeOption {
  letter: Letter;
  name: string;
  sub: string;
  price: number | null;
}

interface Props {
  grades: VisualGradeOption[];
  /** Grade partagé (source de vérité unique, remontée au niveau page). */
  selectedGrade?: string | null;
  /** Remonte le changement de grade au parent → synchronise TOUTE la page. */
  onSelectGrade?: (grade: string) => void;
  imageCoque?: Partial<Record<St, string>>;
  imageEcran?: Partial<Record<St, string>>;
}

const WEAR_TAG: Record<St, string> = {
  a: "Presque aucun signe d'usure",
  b: 'Légers signes d\'usure',
  c: "Signes d'usure visibles",
};

export function VisualStateSelector({ grades, selectedGrade, onSelectGrade, imageCoque, imageEcran }: Props) {
  // Vue coque/écran : état local LÉGITIME (concerne l'affichage, pas le grade).
  const [view, setView] = useState<View>('coque');

  const available = grades.filter((g) => DISPLAY_GRADE_ORDER.includes(g.letter));
  if (available.length === 0) return null;

  // L'état affiché est DÉRIVÉ du grade partagé (pas d'état local dupliqué) : la
  // section reste donc toujours synchronisée avec le sélecteur principal et le
  // reste de la page. Fallback sur le 1er grade dispo si le courant n'en fait
  // pas partie.
  const currentLetter = displayGrade(selectedGrade);
  const activeLetter: Letter = available.some((g) => g.letter === currentLetter)
    ? (currentLetter as Letter)
    : available[0].letter;
  // L'illustration a 3 niveaux d'usure, alignés sur les 3 grades client.
  const st = activeLetter.toLowerCase() as St;

  const scrB = st === 'b' ? 0.6 : st === 'c' ? 0.45 : 0;
  const scrC = st === 'c' ? 0.85 : 0;
  const realImg = (view === 'coque' ? imageCoque : imageEcran)?.[st];

  return (
    <section className="mt-12 md:mt-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 bg-white border border-[#ECECEC] rounded-[20px] p-5 md:p-6 items-start">
        {/* Colonne visuel */}
        <div>
          <div className="relative bg-[#F4F5F7] rounded-[18px] overflow-hidden min-h-[420px] flex items-center justify-center">
            <span className="absolute top-2.5 right-2.5 z-[2] text-[10px] font-semibold text-white bg-black/55 px-2 py-0.5 rounded-md">
              {realImg ? 'Photo réelle' : "Image d'illustration"}
            </span>
            <span className="absolute top-2.5 left-2.5 z-[2] text-xs font-bold text-white bg-black/60 px-3 py-1 rounded-lg">
              {view === 'coque' ? 'Coque' : 'Écran'}
            </span>

            {realImg ? (
              <img src={realImg} alt={`${view} — grade ${st.toUpperCase()}`} className="h-[380px] max-w-[88%] object-contain" />
            ) : view === 'coque' ? (
              <svg viewBox="0 0 200 360" className="h-[380px] w-auto max-w-[88%]" aria-hidden="true">
                <defs>
                  <linearGradient id="vssTi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A2A2AA" /><stop offset=".5" stopColor="#CDCDD4" /><stop offset="1" stopColor="#787880" /></linearGradient>
                  <linearGradient id="vssCm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2B2B33" /><stop offset="1" stopColor="#15151B" /></linearGradient>
                  <radialGradient id="vssLn" cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#1F2128" /><stop offset=".55" stopColor="#0A0B10" /><stop offset="1" stopColor="#000" /></radialGradient>
                </defs>
                <rect x="20" y="10" width="160" height="340" rx="38" fill="url(#vssTi)" />
                <path d="M30 18 Q 70 12 130 12 L 170 12" fill="none" stroke="#F2F2F5" strokeWidth="1.5" opacity=".5" />
                <rect x="32" y="22" width="72" height="72" rx="20" fill="url(#vssCm)" /><rect x="36" y="26" width="64" height="64" rx="17" fill="#191920" />
                <circle cx="54" cy="44" r="14" fill="#2A2A33" /><circle cx="54" cy="44" r="14" fill="none" stroke="#42424B" strokeWidth="2" /><circle cx="54" cy="44" r="10.5" fill="url(#vssLn)" /><circle cx="54" cy="44" r="4.5" fill="#13131A" /><circle cx="54" cy="44" r="2" fill="#000" /><ellipse cx="50" cy="40" rx="2.4" ry="1.4" fill="#fff" opacity=".5" />
                <circle cx="82" cy="72" r="14" fill="#2A2A33" /><circle cx="82" cy="72" r="14" fill="none" stroke="#42424B" strokeWidth="2" /><circle cx="82" cy="72" r="10.5" fill="url(#vssLn)" /><circle cx="82" cy="72" r="4.5" fill="#13131A" /><circle cx="82" cy="72" r="2" fill="#000" /><ellipse cx="78" cy="68" rx="2.4" ry="1.4" fill="#fff" opacity=".5" />
                <circle cx="82" cy="44" r="5.5" fill="#EFEAD8" /><circle cx="82" cy="44" r="5.5" fill="none" stroke="#BCB7A4" strokeWidth="1" /><circle cx="80" cy="42" r="1.3" fill="#fff" opacity=".7" />
                <circle cx="54" cy="72" r="3" fill="#3A3A42" />
                <line x1="80" y1="336" x2="120" y2="336" stroke="#5A5A62" strokeWidth="1.5" opacity=".5" strokeLinecap="round" />
                <g stroke="#FFFFFF" strokeWidth=".7" strokeLinecap="round" fill="none" style={{ opacity: scrB, transition: 'opacity .35s' }}><path d="M30 120 Q 60 124 95 122" /><path d="M120 160 Q 150 164 175 160" /><path d="M50 240 Q 85 242 115 240" /><path d="M155 290 Q 165 294 175 298" /></g>
                <g stroke="#FFFFFF" strokeWidth=".9" strokeLinecap="round" fill="none" style={{ opacity: scrC, transition: 'opacity .35s' }}><path d="M25 175 Q 80 180 140 175" /><path d="M35 220 Q 95 224 160 218" /><path d="M50 270 Q 110 276 170 270" /><path d="M40 315 Q 90 320 145 315" /><path d="M130 140 L 170 144" /><path d="M30 300 L 60 302" /><circle cx="100" cy="200" r="1" fill="#fff" /><circle cx="140" cy="250" r=".8" fill="#fff" /></g>
              </svg>
            ) : (
              <svg viewBox="0 0 200 360" className="h-[380px] w-auto max-w-[88%]" aria-hidden="true">
                <defs>
                  <linearGradient id="vssFr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3E3E46" /><stop offset="1" stopColor="#1E1E26" /></linearGradient>
                  <linearGradient id="vssSc" x1=".3" y1="0" x2=".7" y2="1"><stop offset="0" stopColor="#1B2A4A" /><stop offset=".5" stopColor="#0B1230" /><stop offset="1" stopColor="#080A1E" /></linearGradient>
                  <radialGradient id="vssWp" cx=".5" cy=".25" r=".55"><stop offset="0" stopColor="#3A5FB8" stopOpacity=".6" /><stop offset="1" stopColor="#0B1230" stopOpacity="0" /></radialGradient>
                </defs>
                <rect x="20" y="10" width="160" height="340" rx="38" fill="url(#vssFr)" />
                <rect x="26" y="16" width="148" height="328" rx="32" fill="url(#vssSc)" /><rect x="26" y="16" width="148" height="328" rx="32" fill="url(#vssWp)" />
                <rect x="72" y="28" width="56" height="20" rx="10" fill="#020205" /><circle cx="116" cy="38" r="2.8" fill="#1C2030" /><circle cx="116" cy="38" r="1.3" fill="#3A5FB0" opacity=".55" />
                <path d="M30 80 L 75 16 L 135 16 L 75 130 Z" fill="#FFFFFF" opacity=".06" /><path d="M150 290 L 175 250 L 180 270 L 158 330 Z" fill="#FFFFFF" opacity=".05" />
                <g stroke="#A8B0C8" strokeWidth=".7" strokeLinecap="round" fill="none" style={{ opacity: scrB, transition: 'opacity .35s' }}><path d="M40 160 Q 75 164 115 160" /><path d="M100 210 L 150 214" /><path d="M50 270 Q 90 272 130 270" /></g>
                <g stroke="#B6BED4" strokeWidth=".9" strokeLinecap="round" fill="none" style={{ opacity: scrC, transition: 'opacity .35s' }}><path d="M30 130 Q 90 134 150 130" /><path d="M50 180 Q 100 184 160 180" /><path d="M40 220 L 150 224" /><path d="M40 295 Q 100 298 160 294" /><path d="M80 330 L 150 332" /></g>
              </svg>
            )}

            <div className="absolute left-3 bottom-3 z-[2] flex flex-wrap gap-1.5 max-w-[92%]">
              <span className="text-[11px] font-semibold text-[#2B2740] bg-white/95 rounded-full px-2.5 py-1">{WEAR_TAG[st]}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2B2740] bg-white/95 rounded-full px-2.5 py-1">
                <CircleCheck className="w-3.5 h-3.5 text-[#1FA971]" />
                Pièces vérifiées
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            {(['coque', 'ecran'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 text-[13px] font-semibold rounded-[11px] py-2.5 border transition-colors ${
                  view === v ? 'text-[#0B1437] border-[#0B1437] bg-white' : 'text-[#5A6172] border-[#E6E6E6] bg-white'
                }`}
              >
                {v === 'coque' ? 'Coque' : 'Écran'}
              </button>
            ))}
          </div>
        </div>

        {/* Colonne explication + options */}
        <div>
          <p className="text-[#4B7BFF] font-caveat text-2xl mb-1">L&apos;état, en images</p>
          <h3 className="text-[23px] font-extrabold text-[#0B1437] mb-2">Voyez la différence</h3>
          <p className="text-[13px] text-[#5A6172] leading-relaxed mb-4">
            La même zone du téléphone, selon l&apos;état choisi. Les performances, elles, sont identiques — et tout est garanti 24 mois.
          </p>

          {available.map((g) => {
            const on = g.letter === activeLetter;
            return (
              <button
                key={g.letter}
                onClick={() => onSelectGrade?.(g.letter)}
                className={`flex items-center gap-3 w-full text-left rounded-[13px] px-3.5 py-3 mb-2.5 border transition-all ${
                  on ? 'border-[#2F6BFF] bg-[#F7F9FF] shadow-[0_12px_26px_-20px_rgba(47,107,255,0.45)]' : 'border-[#E8E8E8] bg-white'
                }`}
              >
                <span className={`w-[18px] h-[18px] rounded-full flex-none border-2 ${on ? 'border-[#2F6BFF] bg-[#2F6BFF] shadow-[inset_0_0_0_3px_#fff]' : 'border-[#C9CDD6] bg-white'}`} />
                <span className="flex-1">
                  <b className="block text-sm font-extrabold text-[#0B1437]">Grade {g.letter} · {g.name}</b>
                  <span className="text-[11px] font-semibold text-[#9AA3B2]">{g.sub}</span>
                </span>
                {g.price != null && <span className="text-sm font-extrabold text-[#0B1437]">{g.price.toFixed(0)} €</span>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
