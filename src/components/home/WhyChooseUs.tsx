'use client';

import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

// Section « le choix intelligent / Jusqu'à -40% » — version premium.
// Carte dégradé bleu profond, iPhone détouré qui flotte + halo, chips collés
// (garantie haut-gauche, prix bas-droite). Bouton BLANC au repos (jamais bleu
// sombre), hover léger seulement.
//
// NB visuel : le téléphone utilise une photo produit DÉJÀ détourée du projet
// (apple-iphone-16-pro-max-black-titanium.png, fond transparent, sans
// watermark). Pour brancher une autre photo : déposer le PNG transparent dans
// public/ et changer le src de .tc-deal__phone ci-dessous.

const panelGradient = { background: 'linear-gradient(135deg,#0B1B4A,#1A3C84 55%,#0A1226)' };
const chipStyle = {
  background: 'linear-gradient(180deg,rgba(28,40,80,.96),rgba(15,23,50,.96))',
  border: '1px solid rgba(255,255,255,.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16),0 12px 22px -8px rgba(0,0,0,.55)',
};

export function WhyChooseUs() {
  return (
    <section className="py-16 md:py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div
          className="rounded-[24px] grid grid-cols-1 lg:grid-cols-2 gap-10 items-center text-center lg:text-left p-8 sm:p-12 lg:p-16"
          style={panelGradient}
        >
          {/* Colonne gauche — texte */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="flex flex-col items-center lg:items-start"
          >
            <p className="font-['Caveat'] text-[22px] text-[#6BA5FF] m-0">le choix intelligent ✦</p>
            <h2
              className="font-extrabold text-white leading-[1.05] tracking-[-0.02em] mt-2.5"
              style={{ fontSize: 'clamp(28px,3.4vw,40px)' }}
            >
              Jusqu&apos;à <span className="text-[#5B9BFF]">-40 %</span> sur les meilleurs smartphones
            </h2>
            <p className="text-[15px] text-[#9FB0D4] leading-[1.55] mt-3.5 max-w-[340px] mx-auto lg:mx-0">
              La même expérience qu&apos;un neuf, à un prix qui a enfin du sens.
            </p>

            <Link href="/products">
              <button
                className="group inline-flex items-center gap-2 mt-6 rounded-[13px] px-6 py-3.5 text-[15px] font-bold text-[#0B1437] bg-white hover:bg-[#EAF0FF] transition-all hover:-translate-y-0.5"
                style={{ boxShadow: '0 12px 26px -12px rgba(0,0,0,.5),inset 0 1px 0 #fff' }}
              >
                Découvrir nos offres
                <ArrowRight className="w-4 h-4 text-[#2F6BFF] transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </motion.div>

          {/* Colonne droite — visuel */}
          <div className="relative flex items-center justify-center min-h-[420px]">
            {/* Halo */}
            <div
              className="absolute w-[58%] aspect-square rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle,rgba(91,155,255,.45),transparent 65%)' }}
            />

            {/* Téléphone flottant + chips collés */}
            <motion.div
              animate={{ y: [-6, 6, -6] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative inline-block"
            >
              {/* Chip garantie — haut-gauche */}
              <span
                className="absolute z-[4] flex items-center gap-2 rounded-[13px] px-3 py-2.5 text-[12px] font-bold text-white whitespace-nowrap top-[10%] left-0 lg:-left-[22px]"
                style={chipStyle}
              >
                <ShieldCheck className="w-4 h-4 text-[#6BA5FF]" />
                Garantie 24 mois · incluse
              </span>

              <img
                src="/images/apple-iphone-16-pro-max-black-titanium.png"
                alt="iPhone reconditionné"
                className="block w-auto h-[min(440px,52vh)]"
                style={{ filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.55))' }}
              />

              {/* Logo TEL & CASH superposé sur le dos */}
              <img
                src="/logo-telcash.png"
                alt="TEL and CASH"
                className="absolute left-1/2 -translate-x-1/2 bottom-[24%] w-[84px] opacity-90 pointer-events-none"
              />

              {/* Carte prix — bas-droite */}
              <div
                className="absolute z-[4] flex flex-col rounded-[14px] px-3.5 py-3 bottom-[14%] right-0 lg:-right-[26px]"
                style={chipStyle}
              >
                <span className="text-[11px] text-[#8DA0C8] line-through">859 € neuf</span>
                <span className="text-[20px] font-bold text-white leading-tight">499 €</span>
                <span
                  className="text-[10px] font-bold text-[#9FE7C4] px-2 py-0.5 rounded-full mt-1 self-start"
                  style={{ background: 'rgba(31,169,113,.22)' }}
                >
                  -360 €
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
