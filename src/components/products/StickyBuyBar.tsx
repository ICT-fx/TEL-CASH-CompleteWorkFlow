// Barre d'achat sticky qui apparaît au scroll (façon Back Market).
// Miniature produit + résumé de la variante sélectionnée + prix + bouton.
// Suit la sélection en direct (props rebindées à chaque rendu de la fiche).

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { gradeLabelFr, normalizeGradeLetter } from '@/lib/products';
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

  const letter = normalizeGradeLetter(grade);
  const stateLabel = letter ? `${gradeLabelFr(grade)} · Grade ${letter}` : null;
  const battery = batteryHealth != null ? `Batterie ${batteryHealth} %` : null;
  const summary = [stateLabel, battery, storage, color ? colorLabelFr(color) : null]
    .filter(Boolean)
    .join(' · ');

  const savings = price != null && compareAtPrice != null && compareAtPrice > price
    ? Math.round(compareAtPrice - price)
    : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm"
        >
          <div className="container mx-auto px-3 sm:px-4 max-w-7xl h-16 flex items-center gap-3 sm:gap-5">
            {/* Thumbnail */}
            <div className="hidden sm:flex w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 items-center justify-center overflow-hidden flex-shrink-0">
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

            {/* Price + savings (cachés très petits écrans) */}
            <div className="hidden md:flex flex-col items-end leading-tight flex-shrink-0">
              {price != null ? (
                <>
                  <span className="text-base font-black text-[#0A0F1E] tabular-nums">{price.toFixed(0)} €</span>
                  {savings > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700">économisez {savings} €</span>
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
