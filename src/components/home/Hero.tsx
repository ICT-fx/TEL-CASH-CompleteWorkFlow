'use client';

// Héros de l'accueil — refonte v4 (08/10/2026). UN SEUL composant responsive :
//   - mobile (< md)  = V5 (10/10/2026), inspirée de la proposition « héros V6 » :
//     bleu nuit + éclairage bleu latéral, gros titre, bouton blanc pilule avec
//     flèche bleue ronde, puis l'iPhone mis en scène (halo, socle) avec une carte
//     prix en verre sombre et une pastille « testé en atelier » ;
//   - ordinateur (md+) = maquette Accueil-ordi.dc.html : photo /hero-final.webp
//     FIXE à droite (plus de carrousel), dégradé blanc, bouton bleu en relief,
//     pastilles verre + carte prix verre (xl+, là où la place le permet).
// Un seul <h1>, dont le style change selon la taille.
//
// Prix « dès » de l'iPhone 13 : lu depuis les produits (même requête mutualisée
// que « Les plus demandés »). Valeur de repli ci-dessous, affichée le temps du
// chargement ou si l'API ne répond pas.

import Link from 'next/link';
import { formatFromPrice, useHomeModels } from '@/components/home/BestOffers';

const HERO_CONFIG = {
  model: 'iPhone 14',
  fallbackHref: '/products?q=iPhone%2014',
  // Vraie photo produit du catalogue (pas d'image générée).
  image: '/images/apple-iphone-14-midnight.png',
  desktopPhoto: '/hero-final.webp',
};

// GIF transparent 1×1 : src de repli des <picture> → l'image réservée à l'autre
// format (mobile / ordinateur) n'est jamais téléchargée inutilement.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const MOBILE_MQ = '(max-width: 767.98px)';
const DESKTOP_MQ = '(min-width: 768px)';

function ArrowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function StarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F5A524" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}

export function Hero() {
  const { models } = useHomeModels();
  const live = models.find(
    (m) => m.brand.toLowerCase() === 'apple' && m.model.toLowerCase() === HERO_CONFIG.model.toLowerCase(),
  );
  // La carte prix n'apparaît qu'avec le VRAI prix du catalogue (jamais un prix
  // en dur qui pourrait être faux).
  const price = live ? formatFromPrice(live.minPrice) : null;
  const href = live?.href ?? HERO_CONFIG.fallbackHref;

  return (
    <section
      data-no-reveal
      className="relative overflow-hidden bg-[#0A0F1E] md:bg-white md:h-[640px]"
    >
      {/* ── Fonds ─────────────────────────────────────────────────────────── */}
      {/* Mobile : bleu nuit + éclairage bleu venant de la droite (comme le héros V6) */}
      <div aria-hidden="true" className="md:hidden pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(90% 55% at 100% 72%,rgba(36,87,230,.55),rgba(36,87,230,0) 70%),radial-gradient(60% 40% at 0% 0%,rgba(107,147,255,.16),rgba(107,147,255,0) 70%),linear-gradient(180deg,#0A0F1E 0%,#0B1433 100%)' }} />
      <div aria-hidden="true" className="md:hidden pointer-events-none absolute inset-0 opacity-[.35]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(70% 50% at 70% 75%,#000,transparent)', WebkitMaskImage: 'radial-gradient(70% 50% at 70% 75%,#000,transparent)' }} />

      {/* Ordinateur : une seule photo fixe à droite + dégradé blanc à gauche */}
      <picture>
        <source media={DESKTOP_MQ} srcSet={HERO_CONFIG.desktopPhoto} />
        <img
          src={BLANK}
          alt="Cliente souriante avec son smartphone reconditionné"
          fetchPriority="high"
          decoding="async"
          className="hidden md:block absolute right-0 top-0 h-full w-[62.5%] object-cover"
          style={{ objectPosition: '62% 30%' }}
        />
      </picture>
      <div
        aria-hidden="true"
        className="hidden md:block absolute left-0 top-0 bottom-0 w-[85%] xl:w-[57%]"
        style={{ background: 'linear-gradient(90deg,#FFFFFF 0%,#FFFFFF 62%,rgba(255,255,255,.85) 78%,rgba(255,255,255,0) 100%)' }}
      />

      {/* ── Contenu ───────────────────────────────────────────────────────── */}
      <div className="relative mx-auto max-w-[1232px] px-[18px] pt-6 pb-0 md:px-4 md:py-0 md:h-full flex flex-col md:justify-center gap-4 md:gap-6">
        {/* Badge */}
        <span className="self-start inline-flex items-center gap-2 text-[13px] font-semibold text-white/[.78] md:h-[34px] md:px-3.5 md:rounded-full md:border md:text-sm md:font-bold md:bg-[linear-gradient(180deg,#F1F5FF,#E4ECFF)] md:border-[#D6E1FF] md:text-[#2457E6]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-[#7FA2FF] md:text-current">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          Magasin à Angers · retrait gratuit le jour même
        </span>

        {/* H1 unique — mobile : blanc + dégradé clair ; ordinateur : majuscules, « reconditionné » en bleu */}
        <h1 className="m-0 font-black text-white text-[41px] leading-[1.0] tracking-[-.045em] [text-wrap:balance] md:text-[#0A0F1E] md:uppercase md:text-[52px] md:leading-[.98] md:max-w-[560px] xl:text-[68px] xl:max-w-[640px]">
          Votre smartphone <span className="md:text-[#2457E6]">reconditionné</span>{' '}
          <span className="bg-gradient-to-b from-[#9DB8FF] to-[#5B86FF] bg-clip-text text-transparent md:bg-none md:text-inherit">
            au meilleur prix<span className="md:hidden">.</span>
          </span>
        </h1>

        {/* Sous-titre */}
        <p className="m-0 text-[16px] leading-[1.5] font-medium text-white/[.72] max-w-[330px] md:max-w-none md:text-[19px] md:leading-[1.55] md:font-normal md:text-[#47506A] md:max-w-[520px]">
          <span className="md:hidden">iPhone et Android testés dans notre atelier d&apos;Angers. Garantis 24&nbsp;mois.</span>
          <span className="hidden md:inline">
            iPhone, Samsung &amp; Xiaomi reconditionnés, testés dans notre atelier d&apos;Angers et garantis 24 mois.
          </span>
        </p>

        {/* Bouton + preuves */}
        <div className="flex flex-col gap-4 pt-1 md:flex-row md:items-center md:gap-[18px] md:pt-1">
          {/* Mobile : pilule blanche + flèche bleue ronde (idée du héros V6), pleine largeur pour le pouce */}
          <Link
            href="/products"
            className="md:hidden group flex items-center justify-between h-[62px] pl-6 pr-[7px] rounded-full text-[17px] font-extrabold tracking-[-.01em] text-[#0A0F1E] hover:text-[#0A0F1E] shadow-[0_18px_40px_-14px_rgba(0,0,0,.7),0_0_0_1px_rgba(255,255,255,.6),inset_0_-2px_0_rgba(10,15,30,.06)] active:scale-[.985] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            style={{ background: 'linear-gradient(180deg,#FFFFFF 0%,#F1F4FB 100%)' }}
          >
            Trouver mon smartphone
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_16px_-8px_rgba(36,87,230,.9)]"
              style={{ background: 'linear-gradient(180deg,#4A7BFF 0%,#2457E6 55%,#1C46C9 100%)' }}
            >
              <ArrowIcon size={20} />
            </span>
          </Link>
          <Link href="/products" className="tc-btn hidden md:inline-flex min-h-[58px] px-[30px] text-[17px]">
            Voir les smartphones <ArrowIcon />
          </Link>
          {/* Mobile : 3 preuves courtes */}
          <ul className="md:hidden m-0 p-0 list-none flex items-center justify-between text-[13px] font-semibold text-white/[.76]">
            <li className="flex items-center gap-1.5"><StarIcon size={14} /><b className="text-white">5/5</b> Google</li>
            <li className="flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7FA2FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6Z" /><path d="m9 12 2 2 4-4" /></svg>
              Garantie 24 mois
            </li>
            <li className="flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7FA2FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
              Retour 30 j
            </li>
          </ul>
          <p className="hidden md:flex m-0 items-center gap-2 text-[15px] font-semibold text-[#47506A]">
            <StarIcon size={18} />
            <b className="text-[#0A0F1E]">5/5</b> sur Google · +15 000 clients
          </p>
        </div>

        {/* Mobile : la scène produit — halo, socle, iPhone incliné, carte prix en verre sombre */}
        <div className="md:hidden relative -mx-[18px] h-[372px] mt-1">
          <div aria-hidden="true" className="absolute left-1/2 top-[18px] -translate-x-1/2 w-[318px] h-[318px] rounded-full border border-white/[.09]" style={{ background: 'radial-gradient(closest-side,rgba(74,123,255,.30),rgba(74,123,255,.06) 70%,rgba(74,123,255,0))' }} />
          <div aria-hidden="true" className="absolute left-1/2 top-[58px] -translate-x-1/2 w-[238px] h-[238px] rounded-full border border-white/[.06]" />
          <div aria-hidden="true" className="absolute left-1/2 bottom-[26px] -translate-x-1/2 w-[250px] h-[34px] rounded-[50%]" style={{ background: 'radial-gradient(closest-side,rgba(0,0,0,.65),rgba(0,0,0,0))' }} />
          <div aria-hidden="true" className="absolute left-1/2 bottom-[30px] -translate-x-1/2 w-[290px] h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg,rgba(127,162,255,0),rgba(127,162,255,.55),rgba(127,162,255,0))' }} />
          <picture>
            <source media={MOBILE_MQ} srcSet={HERO_CONFIG.image} />
            <img
              src={BLANK}
              alt="iPhone 14 noir minuit reconditionné"
              fetchPriority="high"
              decoding="async"
              className="absolute left-1/2 top-[2px] h-[350px] w-auto max-w-none"
              style={{ transform: 'translateX(-50%) rotate(-7deg)', filter: 'drop-shadow(0 30px 34px rgba(0,0,0,.6)) drop-shadow(0 0 40px rgba(74,123,255,.25))' }}
            />
          </picture>
          <span className="absolute left-[12px] top-[26px] flex items-center gap-2.5 rounded-[16px] pl-2.5 pr-3.5 py-2.5 border border-white/[.16] text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-md" style={{ background: 'linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.05))' }}>
            <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2457E6]/30 border border-[#7FA2FF]/40">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-medium text-white/70">Testé en atelier</span>
              <span className="text-[13px] font-bold">+ de 60 contrôles</span>
            </span>
          </span>
          {price && (
          <Link
            href={href}
            aria-label={`${HERO_CONFIG.model} reconditionné dès ${price}`}
            className="absolute right-[16px] bottom-[44px] flex items-center gap-3.5 rounded-[20px] pl-4 pr-3 py-3 border border-white/[.18] text-white hover:text-white shadow-[0_22px_40px_-14px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.2)] backdrop-blur-md"
            style={{ background: 'linear-gradient(150deg,rgba(40,58,110,.72),rgba(12,20,48,.72))' }}
          >
            <span className="flex flex-col">
              <span className="text-[13px] font-semibold text-white/70">{HERO_CONFIG.model}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[13px] font-semibold text-white/70">dès</span>
                <b className="text-[32px] font-extrabold tracking-[-.04em] leading-none">{price}</b>
              </span>
            </span>
            <span className="w-11 h-11 rounded-full flex items-center justify-center bg-white/[.1] border border-white/[.22]">
              <ArrowIcon size={18} />
            </span>
          </Link>
          )}
        </div>

        {/* Ordinateur (xl+) : pastilles verre + carte prix verre */}
        <span className="tc-glass hidden xl:flex absolute left-[656px] top-[120px] h-10 px-4 rounded-full items-center gap-2 text-sm font-bold text-[#0A0F1E]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="7" width="17" height="10" rx="2" />
            <path d="M22 11v2" />
            <path d="M5 10h7v4H5z" fill="#16A34A" />
          </svg>
          Batterie ≥ 85 % garantie
        </span>
        <span className="tc-glass hidden xl:flex absolute left-[656px] top-[172px] h-10 px-4 rounded-full items-center gap-2 text-sm font-bold text-[#0A0F1E]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#157F3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10v10h16V10" />
            <path d="M3 10 5 4h14l2 6" />
            <path d="M9 20v-6h6v6" />
          </svg>
          Retrait gratuit le jour même
        </span>
        {price && (
        <Link
          href={href}
          aria-label={`${HERO_CONFIG.model} reconditionné dès ${price}`}
          className="tc-glass hidden xl:flex absolute left-[656px] top-[318px] rounded-[20px] px-[18px] py-4 items-center gap-4 text-[#0A0F1E] hover:text-[#0A0F1E] transition-transform hover:-translate-y-0.5"
        >
          <img
            src={HERO_CONFIG.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-[70px] w-auto"
            style={{ filter: 'drop-shadow(0 8px 10px rgba(11,20,55,.25))' }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold text-[#47506A]">{HERO_CONFIG.model}</span>
            <span className="text-sm font-semibold">
              dès{' '}
              <b
                className="text-[30px] font-black tracking-[-.03em] bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(180deg,#1B2A5E,#0A0F1E)' }}
              >
                {price}
              </b>
            </span>
          </span>
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_16px_-8px_rgba(36,87,230,.8)]"
            style={{ background: 'linear-gradient(180deg,#4A7BFF,#1C46C9)' }}
          >
            <ArrowIcon size={18} />
          </span>
        </Link>
        )}
      </div>
    </section>
  );
}
