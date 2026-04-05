'use client';

import { Hero } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { Categories } from '@/components/home/Categories';
import { BestOffers } from '@/components/home/BestOffers';
import { BestSeller } from '@/components/home/BestSeller';
import { Grades } from '@/components/home/Grades';
import { HowItWorks } from '@/components/home/HowItWorks';
import { StoreStory } from '@/components/home/StoreStory';
import { WhyChooseUs } from '@/components/home/WhyChooseUs';
import { Reviews } from '@/components/home/Reviews';
import { Warranty } from '@/components/home/Warranty';
import { WhyRefurbished } from '@/components/home/WhyRefurbished';
import { FAQ } from '@/components/home/FAQ';
import { motion } from 'framer-motion';

export default function HomePage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Hero />
      <Marquee />
      {/* 1. Ticker → dark navy #0A0F1E */}
      <Categories />
      {/* 2. La référence du reconditionné premium → off-white chaud #F9F8F5 */}
      <WhyChooseUs />
      {/* 3. -40% smartphones → dark navy #0A0F1E */}
      <BestOffers />
      {/* 4. Recommandés pour vous → off-white chaud #F9F8F5 */}
      <BestSeller />
      {/* 5. Le choix de l'excellence → off-white chaud #F9F8F5 */}
      <WhyRefurbished />
      {/* 6. Un smartphone reconditionné c'est quoi ? → off-white chaud #F9F8F5 */}
      <Warranty />
      {/* 7. Garantie & SAV 100% Français → blanc pur #FFFFFF */}
      <Grades />
      {/* 8. Nos grades de qualité → off-white chaud #F9F8F5 */}
      <HowItWorks />
      {/* 9. Comment ça marche ? → dark navy #0A0F1E */}
      <Reviews />
      {/* 10. Ils nous font confiance → blanc pur #FFFFFF */}
      <StoreStory />
      {/* 11. Pas un entrepôt / boutique → off-white chaud #F9F8F5 */}
      <FAQ />
      {/* 12. Newsletter + FAQ → blanc pur #FFFFFF */}
    </motion.div>
  );
}
