// Marque Klarna réutilisable — source unique de vérité pour le logo et le
// message « paiement en plusieurs fois » affichés sur tout le site (fiches
// produit, panier, checkout). Le paiement réel est géré par Stripe, qui
// propose Klarna sur sa page de paiement ; ces composants ne font qu'informer
// le client AVANT la redirection.

import { CalendarClock } from 'lucide-react';

// Rose officiel Klarna (« Klarna Pink »).
const KLARNA_PINK = '#FFB3C7';
const KLARNA_INK = '#0B051D';

interface KlarnaBadgeProps {
  className?: string;
  /** Hauteur du badge en px (défaut 18). */
  size?: number;
}

// Le wordmark « Klarna » sur pastille rose arrondie. Reproduit le badge
// officiel (texte noir sur fond rose) en SVG/texte natif, sans asset externe.
export function KlarnaBadge({ className = '', size = 18 }: KlarnaBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[5px] font-extrabold leading-none ${className}`}
      style={{
        height: size,
        padding: `0 ${Math.round(size * 0.42)}px`,
        fontSize: Math.round(size * 0.62),
        letterSpacing: '-0.02em',
        backgroundColor: KLARNA_PINK,
        color: KLARNA_INK,
      }}
      aria-label="Klarna"
      title="Klarna"
    >
      Klarna
    </span>
  );
}

interface KlarnaInstallmentProps {
  /** `pill` : pastille compacte (rangée de badges). `card` : encart visible. */
  variant?: 'pill' | 'card';
  /** Sous-titre de l'encart `card` (où/comment ça se passe). */
  subtitle?: string;
  className?: string;
}

const DEFAULT_SUBTITLE = 'Sans frais — à choisir lors du paiement sécurisé.';

// Encart « Payez en 3× ou 4× avec Klarna ». Met en évidence, avant la page de
// paiement, que le paiement en plusieurs fois passe par Klarna.
export function KlarnaInstallment({
  variant = 'card',
  subtitle = DEFAULT_SUBTITLE,
  className = '',
}: KlarnaInstallmentProps) {
  if (variant === 'pill') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 h-[26px] pl-1.5 pr-2.5 rounded-[6px] bg-[#FFF0F4] border border-[#FFD9E3] ${className}`}
        title="Payez en 3× ou 4× avec Klarna"
      >
        <KlarnaBadge size={18} />
        <span className="text-[11px] font-bold text-[#C1356B]">3× ou 4× sans frais</span>
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-[#FFD9E3] bg-[#FFF5F8] p-4 ${className}`}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: KLARNA_PINK }}
      >
        <CalendarClock className="h-5 w-5" style={{ color: KLARNA_INK }} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
          Payez en 3× ou 4× avec <KlarnaBadge size={18} />
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
