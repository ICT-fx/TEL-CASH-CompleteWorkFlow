// Étape 5 (v3) — 4 cartes de réassurance individuelles, aérées : icône cerclée
// bleue + titre + sous-titre, ombre douce, fond BLANC (plus de bandeau beige).

import { ShieldCheck, RotateCcw, Truck, Lock, type LucideIcon } from 'lucide-react';

const ITEMS: { icon: LucideIcon; title: string; subtitle: string }[] = [
  { icon: ShieldCheck, title: 'Garantie 24 mois', subtitle: 'Pièces & main d’œuvre' },
  { icon: RotateCcw,   title: 'Retour 30 jours',   subtitle: 'Satisfait ou remboursé' },
  { icon: Truck,       title: 'Livraison express', subtitle: '48h en France' },
  { icon: Lock,        title: 'Paiement sécurisé', subtitle: 'Vos données protégées' },
];

export function ReassuranceBand() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {ITEMS.map(({ icon: Icon, title, subtitle }) => (
        <div
          key={title}
          className="bg-white border border-[#EEEEEE] rounded-2xl p-5 text-center shadow-[0_10px_26px_-20px_rgba(20,30,80,0.25)]"
        >
          <span className="mx-auto w-[46px] h-[46px] rounded-full bg-[#EEF3FF] text-[#2F6BFF] flex items-center justify-center">
            <Icon className="w-[22px] h-[22px]" strokeWidth={2} />
          </span>
          <p className="text-[13.5px] font-extrabold text-[#0B1437] mt-3">{title}</p>
          <p className="text-[11px] text-[#9AA3B2] mt-0.5">{subtitle}</p>
        </div>
      ))}
    </div>
  );
}
