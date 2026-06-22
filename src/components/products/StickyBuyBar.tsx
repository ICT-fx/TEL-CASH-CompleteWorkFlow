// Barre d'achat sticky qui apparaît au scroll (façon Back Market).
// Miniature produit + résumé de la variante sélectionnée + prix + bouton.
// Suit la sélection en direct (props rebindées à chaque rendu de la fiche).

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
  compareAtPrice: number | null;
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
  compareAtPrice,
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
  const stateLabel = letter
    ? `${displayGradeLabelFr(grade)} · Grade ${letter}`
    : null;
  const battery = batteryHealth != null ? `Batterie ${batteryHealth} %` : null;
  const summary = [stateLabel, battery, storage && storage !== '—' ? storage : null, color ? colorLabelFr(color) : null]
    .filter(Boolean)
    .join(' · ');

  const savings = price != null && compareAtPrice != null && compareAtPrice > price
    ? Math.round(compareAtPrice - price)
    : 0;

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
                <img src={image} alt={model} className="w-full h-full object-contain p-1" />
              )}
            </div>

            {/* Title + summary */}
            <div className="flex-grow min-w-0">
              <p className="text-sm font-black text-[#0A0F1E] leading-tight truncate">
                {brand} {model}
              </p>
              {summary && (
                <p className="text-[11px] text-slate-500 font-medium truncate">{summary}</p>
              )}
            </div>

            {/* Price + savings */}
            <div className="flex flex-col items-end leading-tight flex-shrink-0">
              {price != null ? (
                <>
                  <span className="text-base font-black text-[#0B1437] tabular-nums">{price.toFixed(0)} €</span>
                  {savings > 0 && (
                    <span className="text-[10px] font-bold text-[#0E7A52]">économisez {savings} €</span>
                  )}
                </>
              ) : (
                <span className="text-xs font-bold text-slate-400">—</span>
              )}
            </div>

            {/* CTA */}
            <Button
              onClick={onAddToCart}
              disabled={disabled || addedToCart}
              className={`flex-shrink-0 px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                disabled
                  ? 'bg-slate-300 text-slate-100 cursor-not-allowed'
                  : 'bg-[#2563EB] hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {addedToCart ? 'Ajouté' : disabled ? 'Indispo' : 'Ajouter'}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
