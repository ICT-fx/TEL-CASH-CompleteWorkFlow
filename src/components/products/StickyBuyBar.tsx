// Barre d'achat sticky qui apparaît au scroll (façon Back Market).
// Miniature produit + résumé de la variante sélectionnée + prix + bouton.
// Suit la sélection en direct (props rebindées à chaque rendu de la fiche).
// Refonte v4 : plus AUCUN prix barré ni « économisez » (prix seul).

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { displayGradeLabelFr, displayGrade } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

interface Props {
  brand: string;
  model: string;
  image: string;
  storage: string | null;
  color: string | null;
  grade: string | null;
  batteryHealth?: number | null;
  price: number | null;
  onAddToCart: () => void;
  addedToCart: boolean;
  disabled: boolean;
  // Pixel offset after which the bar slides into view.
  triggerAfterPx?: number;
}

export function StickyBuyBar({
  brand,
  model,
  image,
  storage,
  color,
  grade,
  batteryHealth,
  price,
  onAddToCart,
  addedToCart,
  disabled,
  triggerAfterPx = 420,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > triggerAfterPx);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [triggerAfterPx]);

  const letter = displayGrade(grade);
  const stateLabel = letter ? displayGradeLabelFr(grade) : null;
  // Minimum garanti par grade (cf. GRADE_BATTERY_MIN) → toujours « ≥ ».
  const battery = batteryHealth != null ? `Batt. ≥ ${batteryHealth} %` : null;
  const summary = [stateLabel, battery, storage && storage !== '—' ? storage : null, color ? colorLabelFr(color) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-xl border-t border-[#ECECEC] shadow-[0_-8px_24px_-16px_rgba(20,30,80,0.25)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="container mx-auto px-3 sm:px-4 max-w-7xl h-16 flex items-center gap-3 sm:gap-5">
            {/* Thumbnail */}
            <div className="flex w-12 h-12 rounded-xl bg-[#FAFAFA] border border-[#ECECEC] items-center justify-center overflow-hidden flex-shrink-0">
              {image && (
                <img src={image} alt={`${model} reconditionné`} className="w-full h-full object-contain p-1" />
              )}
            </div>

            {/* Title + summary */}
            <div className="flex-grow min-w-0">
              <p className="text-[14px] font-extrabold text-[#0A0F1E] leading-tight truncate">
                {model || brand}
              </p>
              {summary && (
                <p className="text-[13px] text-[#5B6478] font-medium truncate">{summary}</p>
              )}
            </div>

            {/* Prix seul (pas de prix barré) */}
            <div className="flex flex-col items-end leading-tight flex-shrink-0">
              {price != null ? (
                <span className="text-[17px] font-extrabold text-[#0A0F1E] tabular-nums">{price.toFixed(0)} €</span>
              ) : (
                <span className="text-[13px] font-bold text-slate-400">—</span>
              )}
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={onAddToCart}
              disabled={disabled || addedToCart}
              className={`tc-btn flex-shrink-0 !min-h-[44px] !px-4 !rounded-xl !text-[14px] whitespace-nowrap ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              {addedToCart ? 'Ajouté' : disabled ? 'Indispo' : 'Ajouter'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
