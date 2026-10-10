import Link from 'next/link';
import { ManageCookiesButton } from '@/components/consent/ManageCookiesButton';
import {
  PICKUP_STORE_ADDRESS_LINE1,
  PICKUP_STORE_ADDRESS_LINE2,
  PICKUP_STORE_PHONE,
} from '@/lib/shipping';

// Pied de page — refonte v4 (maquettes Main.dc.html / Accueil-ordi.dc.html).
// NAP (nom, adresse, téléphone) en texte : constantes de src/lib/shipping.ts.

const GMAPS_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2700.4!2d-0.5521073!3d47.4734511!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x480879224532671b%3A0x482a7e7aeb686dcb!2sTel%20and%20Cash%20Angers!5e0!3m2!1sfr!2sfr!4v1711630000000!5m2!1sfr!2sfr";
const GMAPS_DIRECTIONS =
  'https://www.google.com/maps/dir/?api=1&destination=Tel+and+Cash+Angers,+10+rue+Saint-%C3%89tienne,+49100+Angers';
// Version courte de PICKUP_STORE_HOURS (« Lundi-Samedi, 10h - 19h (fermé le dimanche) »).
const STORE_HOURS_SHORT = 'lun.–sam. 10h–19h';
const TEL_HREF = `tel:${PICKUP_STORE_PHONE.replace(/\s+/g, '')}`;

// Icônes de marque inline (lucide-react ne fournit pas TikTok / Snapchat).
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.2a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1 0-5.18c.27 0 .53.04.78.12v-3.16a5.74 5.74 0 0 0-.78-.05A5.73 5.73 0 1 0 15.6 15.2V9.01a7.36 7.36 0 0 0 4.4 1.45V7.3a4.28 4.28 0 0 1-3.4-1.48z"/>
    </svg>
  );
}
function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.02 2c1.86.01 3.62 1.03 4.4 2.79.28.65.27 1.49.27 2.31 0 .3-.02.78-.04 1.24.18.1.42.16.66.16.34-.01.7-.13 1.06-.36a.6.6 0 0 1 .33-.1c.16 0 .32.05.45.14.2.13.27.33.27.5 0 .42-.5.74-1 .95-.18.08-.45.16-.63.27-.2.13-.16.34-.05.6.02.04 1.06 2.36 3.32 2.73.2.03.34.2.34.4 0 .08-.02.15-.05.22-.2.46-1.16.8-2.36 1-.07.1-.13.43-.2.7-.05.21-.18.4-.46.4-.1 0-.22-.02-.36-.05a4.6 4.6 0 0 0-.95-.1c-.25 0-.5.02-.77.07-.5.1-.93.55-1.43.96-.66.54-1.4 1.15-2.6 1.15h-.1c-1.2 0-1.94-.61-2.6-1.15-.5-.41-.93-.86-1.43-.96a3.9 3.9 0 0 0-.77-.07c-.42 0-.76.06-.95.1-.14.03-.26.05-.36.05-.34 0-.43-.27-.47-.4-.08-.27-.13-.6-.2-.7-1.2-.2-2.16-.54-2.36-1a.55.55 0 0 1-.05-.22c0-.2.14-.37.34-.4 2.26-.37 3.3-2.69 3.32-2.73.11-.26.15-.47-.05-.6-.18-.11-.45-.19-.63-.27-.5-.21-1-.53-1-.95 0-.17.07-.37.27-.5a.78.78 0 0 1 .45-.14c.1 0 .22.03.33.1.36.23.72.35 1.06.36.24 0 .48-.06.66-.16-.02-.46-.04-.94-.04-1.24 0-.82-.01-1.66.27-2.31C8.4 3.03 10.16 2.01 12.02 2z"/>
    </svg>
  );
}

const SOCIALS = [
  { href: 'https://www.instagram.com/angers.telandcash/', label: 'Instagram TEL & CASH', Icon: InstagramIcon },
  { href: 'https://www.tiktok.com/@telandcash', label: 'TikTok TEL & CASH', Icon: TikTokIcon },
  { href: 'https://www.snapchat.com/add/telandcash49', label: 'Snapchat TEL & CASH', Icon: SnapchatIcon },
];

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/products', label: 'Smartphones' },
  // /accessoires redirige vers cette URL : on pointe directement sur la vraie route.
  { href: '/products?category=accessoires', label: 'Accessoires' },
  { href: '/qui-sommes-nous', label: 'Qui sommes-nous ?' },
  { href: '/engagements', label: 'Nos engagements' },
];
const SERVICE_LINKS = [
  { href: '/engagements', label: 'Garantie 24 mois' },
  { href: '/reconditionnement', label: 'Le reconditionnement' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/contact', label: 'Nous contacter' },
];
const LEGAL_LINKS = [
  { href: '/cgv', label: 'Conditions générales de vente' },
  { href: '/confidentialite', label: 'Politique de confidentialité' },
  { href: '/mentions', label: 'Mentions légales' },
];

const linkClass =
  'flex items-center min-h-[44px] md:min-h-0 text-sm md:text-[15px] text-[#C5CCDD] hover:text-white transition-colors text-left';
const headingClass = 'mb-1 md:mb-0 text-xs font-bold tracking-[.12em] md:tracking-[.14em] uppercase text-white';

function PayBadge({ children, klarna = false }: { children: React.ReactNode; klarna?: boolean }) {
  return (
    <span
      className={`h-7 px-[9px] rounded-[7px] text-[13px] flex items-center ${
        klarna ? 'bg-[#FFB3C7] font-extrabold text-[#0B051D]' : 'bg-white/10 border border-white/[.12] font-bold text-white'
      }`}
    >
      {children}
    </span>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#0A0F1E] text-[#C5CCDD] text-sm md:text-[15px]">
      <div className="mx-auto max-w-[1232px] px-4 pt-7 pb-8 md:pt-16 md:pb-8 flex flex-col gap-6 md:gap-12">
        {/* Carte Google Maps + carte verre */}
        <div className="relative rounded-[18px] md:rounded-[22px] overflow-hidden shadow-[0_18px_36px_-20px_rgba(0,0,0,.8)] md:shadow-[0_24px_48px_-28px_rgba(0,0,0,.9)]">
          <iframe
            src={GMAPS_EMBED}
            className="block w-full h-[214px] md:h-[240px] border-0"
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Plan : Tel and Cash, 10 rue Saint-Étienne à Angers"
          />
          <div className="tc-glass absolute left-2.5 right-2.5 bottom-2.5 md:right-auto md:bottom-auto md:left-6 md:top-1/2 md:-translate-y-1/2 rounded-[14px] md:rounded-[18px] p-2 md:p-3 flex items-center gap-2.5 md:gap-3.5 text-[#0A0F1E]">
            <img
              src="/boutique.jpg"
              alt=""
              loading="lazy"
              decoding="async"
              className="w-[52px] h-[52px] md:w-24 md:h-[72px] rounded-[10px] md:rounded-xl object-cover shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col md:gap-0.5 md:pr-1.5">
              <b className="text-sm md:text-base">Tel and Cash Angers</b>
              <span className="text-[13px] md:text-sm text-[#47506A]">
                {PICKUP_STORE_ADDRESS_LINE1}
                <span className="hidden md:inline">, {PICKUP_STORE_ADDRESS_LINE2}</span>
              </span>
              <span className="text-[13px] md:text-sm text-[#47506A]">
                {STORE_HOURS_SHORT}
                <span className="hidden md:inline"> · {PICKUP_STORE_PHONE}</span>
              </span>
            </div>
            <a
              href={GMAPS_DIRECTIONS}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Itinéraire vers le magasin"
              className="tc-btn shrink-0 w-11 min-h-[44px] h-11 p-0 rounded-xl md:w-auto md:h-12 md:min-h-[48px] md:px-[18px] md:rounded-[13px] md:text-[15px]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="md:hidden">
                <path d="M3 11 21 3l-8 18-2-8-8-2Z" />
              </svg>
              <span className="hidden md:inline">Itinéraire</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] gap-x-3 gap-y-5 md:gap-12">
          {/* Marque + NAP + réseaux */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-3 md:gap-4">
            <Link href="/" className="self-start bg-white rounded-xl px-3 py-2 md:px-3.5 md:py-[9px] flex" aria-label="Tel and Cash, accueil">
              <img src="/logo-telcash.png" alt="Tel and Cash, votre tel à prix cash" className="h-7 md:h-8 w-auto object-contain" />
            </Link>
            <p className="m-0 leading-[1.55] md:leading-[1.6]">
              Votre expert français en smartphones reconditionnés premium. Qualité certifiée et garantie 24 mois.
            </p>
            <p className="m-0 leading-[1.6] text-white">
              {PICKUP_STORE_ADDRESS_LINE1}, {PICKUP_STORE_ADDRESS_LINE2}
              <br />
              <a href={TEL_HREF} className="text-white hover:text-white underline-offset-2 hover:underline">{PICKUP_STORE_PHONE}</a> · {STORE_HOURS_SHORT}
            </p>
            <div className="flex gap-2.5">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:text-white border border-white/[.14] bg-[linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.06))] shadow-[inset_0_1px_0_rgba(255,255,255,.2)] hover:bg-[#2457E6] transition-colors"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <nav aria-label="Navigation du pied de page" className="flex flex-col md:gap-3.5">
            <h3 className={headingClass}>Navigation</h3>
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </nav>

          {/* Services */}
          <div className="flex flex-col md:gap-3.5">
            <h3 className={headingClass}>Services</h3>
            {SERVICE_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </div>

          {/* Légal & paiement */}
          <div className="col-span-2 md:col-span-1 flex flex-col md:gap-3.5">
            <h3 className={headingClass}>Légal &amp; paiement</h3>
            <div className="grid grid-cols-2 gap-x-3 md:flex md:flex-col md:gap-3.5">
              {LEGAL_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className={linkClass}>{l.label}</Link>
              ))}
              <ManageCookiesButton className={linkClass} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3 md:mt-1" aria-label="Moyens de paiement acceptés">
              <PayBadge>CB</PayBadge>
              <PayBadge>VISA</PayBadge>
              <PayBadge>Mastercard</PayBadge>
              <PayBadge klarna>Klarna</PayBadge>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 md:pt-[22px] flex flex-col md:flex-row md:justify-between gap-1.5 text-[13px] md:text-sm text-[#8C95AB]">
          <span>© {new Date().getFullYear()} Tel and Cash. Tous droits réservés.</span>
          <span className="flex items-center gap-1.5 md:gap-2">
            Fait avec passion en France
            <span aria-hidden="true" className="inline-flex w-[18px] h-3 md:w-5 md:h-[13px] rounded-[2px] overflow-hidden">
              <i className="flex-1 bg-[#2552B9]" />
              <i className="flex-1 bg-white" />
              <i className="flex-1 bg-[#E1000F]" />
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
