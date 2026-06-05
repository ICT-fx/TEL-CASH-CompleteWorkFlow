// Badges de paiement visuels (SVG inline, aucune image externe) affichés sous
// le bouton d'achat. Discrets, alignés, coins 6px, fond blanc, bord crème.

interface Props {
  className?: string;
}

const badgeBase =
  'inline-flex items-center justify-center h-[26px] px-2 rounded-[6px] bg-white border border-[#E7E1D3]';

export function PaymentBadges({ className = '' }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Moyens de paiement acceptés">
      {/* Visa */}
      <span className={badgeBase} title="Visa">
        <span className="text-[12px] font-black italic tracking-tight text-[#1A1F71]">VISA</span>
      </span>

      {/* Mastercard */}
      <span className={badgeBase} title="Mastercard">
        <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true">
          <circle cx="11.5" cy="9" r="6.5" fill="#EB001B" />
          <circle cx="18.5" cy="9" r="6.5" fill="#F79E1B" />
          <path d="M15 4.1a6.5 6.5 0 0 0 0 9.8 6.5 6.5 0 0 0 0-9.8Z" fill="#FF5F00" />
        </svg>
      </span>

      {/* CB — Carte Bleue */}
      <span className={badgeBase} title="Carte Bleue">
        <span className="text-[11px] font-black tracking-tight text-[#0B1437]">
          C<span className="text-[#2F6BFF]">B</span>
        </span>
      </span>

      {/* Apple Pay */}
      <span className={badgeBase} title="Apple Pay">
        <svg width="11" height="13" viewBox="0 0 14 17" aria-hidden="true" className="mr-1">
          <path
            fill="#0B1437"
            d="M11.2 9c0-1.7 1.4-2.5 1.45-2.55-.8-1.16-2.03-1.32-2.47-1.34-1.05-.1-2.05.62-2.58.62-.53 0-1.36-.6-2.23-.59-1.15.02-2.2.67-2.79 1.7-1.19 2.07-.3 5.13.86 6.8.57.82 1.24 1.74 2.12 1.7.85-.03 1.18-.55 2.2-.55 1.03 0 1.32.55 2.22.53.92-.01 1.5-.83 2.06-1.66.65-.95.92-1.87.93-1.92-.02-.01-1.78-.69-1.8-2.73Zm-1.7-5.02c.47-.57.78-1.36.7-2.15-.67.03-1.49.45-1.97 1.01-.43.5-.81 1.31-.71 2.08.75.06 1.51-.38 1.98-.94Z"
          />
        </svg>
        <span className="text-[11px] font-bold text-[#0B1437]">Pay</span>
      </span>

      {/* Google Pay */}
      <span className={badgeBase} title="Google Pay">
        <span className="text-[11px] font-bold tracking-tight">
          <span className="text-[#4285F4]">G</span>
          <span className="text-[#EA4335]"> </span>
          <span className="text-[#0B1437]">Pay</span>
        </span>
      </span>

      {/* 3× sans frais */}
      <span
        className="inline-flex items-center h-[26px] px-2.5 rounded-[6px] bg-[#F0F5FF] text-[11px] font-bold text-[#2F6BFF]"
        title="Paiement en 3 fois sans frais"
      >
        3× sans frais
      </span>
    </div>
  );
}
