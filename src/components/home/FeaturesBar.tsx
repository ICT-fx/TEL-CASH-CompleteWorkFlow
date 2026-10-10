'use client';

// Barre de réassurance — refonte v4 (maquettes).
//   - mobile : grille 2 × 2, icône + texte sur une ligne ;
//   - ordinateur : 4 colonnes, icône dans une pastille en relief.
// Rendue par PublicLayout avant le footer (toutes les pages) ET, sur l'accueil
// ordinateur, juste sous le héros (page.tsx, placement="home"). Pour ne pas la
// montrer deux fois, l'instance du layout se masque sur l'accueil en md+.

import { usePathname } from 'next/navigation';
import { SHIPPING_DELAY_LABEL, SHIPPING_DELAY_SHORT } from '@/lib/shipping';

const ICONS = {
  shield: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>
  ),
  france: <path d="M12 2 8.5 4.5 9 8 5.5 10 7 14.5 6 18l5 2 4.5-1.5 3.5 2L20 16l-3-4 1.5-3.5L16 6l-4-4z" />,
};

const FEATURES: { icon: keyof typeof ICONS; text: string; mobileText?: string }[] = [
  { icon: 'shield', text: 'Garantie 24 mois' },
  { icon: 'calendar', text: "30 j pour changer d'avis" },
  { icon: 'truck', text: SHIPPING_DELAY_LABEL, mobileText: SHIPPING_DELAY_SHORT },
  { icon: 'france', text: 'Entreprise française' },
];

export function FeaturesBar({
  placement = 'layout',
  className = '',
}: {
  placement?: 'layout' | 'home';
  className?: string;
}) {
  const pathname = usePathname();
  // Instance du layout sur l'accueil : déjà affichée sous le héros en md+.
  const hideOnDesktop = placement === 'layout' && pathname === '/';

  return (
    <section
      data-no-reveal
      aria-label="Nos garanties"
      className={`bg-white border-t border-[#ECEEF3] ${hideOnDesktop ? 'md:hidden' : ''} ${className}`}
    >
      <ul className="m-0 list-none mx-auto max-w-[1232px] px-4 pt-[26px] pb-7 md:pt-9 md:pb-11 grid grid-cols-2 md:grid-cols-4 gap-x-2.5 gap-y-3 md:gap-6">
        {FEATURES.map((f) => (
          <li
            key={f.icon}
            className="flex items-center gap-2.5 text-sm font-semibold text-[#0A0F1E] md:flex-col md:gap-3 md:text-[15px] md:text-center"
          >
            <span className="shrink-0 text-[#2457E6] md:w-14 md:h-14 md:rounded-[18px] md:flex md:items-center md:justify-center md:border md:border-[#DFE7FB] md:bg-[linear-gradient(180deg,#FFFFFF,#EEF3FF)] md:shadow-[inset_0_1px_0_#fff,0_10px_20px_-12px_rgba(36,87,230,.45)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="w-5 h-5 md:w-[26px] md:h-[26px]"
              >
                {ICONS[f.icon]}
              </svg>
            </span>
            {f.mobileText ? (
              <>
                <span className="md:hidden">{f.mobileText}</span>
                <span className="hidden md:inline">{f.text}</span>
              </>
            ) : (
              <span>{f.text}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
