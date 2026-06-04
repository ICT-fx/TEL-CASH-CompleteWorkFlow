// Petit composant étoiles. Si fillFraction=4.6 → 4 pleines, 1 demi (60%),
// 0 vide ; total = 5. Utilisé près du titre produit ET dans la section avis.

import { Star } from 'lucide-react';

interface Props {
  value: number;          // 0–5
  size?: number;          // px
  className?: string;
}

export function Stars({ value, size = 14, className = '' }: Props) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${clamped} sur 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, clamped - i)); // 0..1
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0 text-slate-200 fill-slate-200"
              style={{ width: size, height: size }}
            />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className="text-yellow-400 fill-yellow-400"
                style={{ width: size, height: size }}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}
