// 4 trust signals shown under the add-to-cart block. Mobile : grille 2×2.
// Desktop : ligne unique. Discret, sans halo coloré, façon Back Market.

import { ShieldCheck, RotateCcw, Truck, Lock } from 'lucide-react';

const ITEMS = [
  { icon: ShieldCheck, title: 'Garantie 24 mois',  subtitle: 'Pièces et main d\'œuvre' },
  { icon: RotateCcw,   title: 'Retour 30 jours',    subtitle: 'Satisfait ou remboursé' },
  { icon: Truck,       title: 'Livraison express',  subtitle: '48h en France' },
  { icon: Lock,        title: 'Paiement sécurisé',  subtitle: 'CB / Apple Pay / 3x' },
];

export function ReassuranceBand() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 md:p-5">
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {ITEMS.map(({ icon: Icon, title, subtitle }) => (
          <li
            key={title}
            className="flex items-start gap-3 text-left"
          >
            <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Icon className="w-4 h-4 text-blue-600" />
            </span>
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-bold text-[#0A0F1E] leading-tight">{title}</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 leading-tight">{subtitle}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
