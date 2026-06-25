import Link from 'next/link';
import { Instagram } from 'lucide-react';

const GMAPS_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2700.4!2d-0.5521073!3d47.4734511!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x480879224532671b%3A0x482a7e7aeb686dcb!2sTel%20and%20Cash%20Angers!5e0!3m2!1sfr!2sfr!4v1711630000000!5m2!1sfr!2sfr";

// Icônes de marque inline (lucide-react ne fournit pas TikTok / Snapchat).
// `currentColor` → suivent la couleur du lien (blanc, comme l'Instagram lucide).
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

export function Footer() {
  return (
    <footer className="bg-[#0A0F1E] text-white pt-16 pb-8">
      <div className="container mx-auto px-4 max-w-7xl">
        
        {/* Google Maps embed — full width above main grid */}
        <div className="mb-12">
          <iframe
            src={GMAPS_EMBED}
            width="100%"
            height="200"
            style={{
              border: 0,
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Tel and Cash Angers — Google Maps"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          {/* Logo & Description */}
          <div>
            <Link href="/" className="flex items-center mb-6">
              <img
                src="/logo-telcash.png"
                alt="Tel and Cash — votre tel à prix cash"
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-white/60 mb-6 text-sm leading-relaxed">
              Votre expert français en smartphones reconditionnés premium.
              Qualité certifiée et garantie 24 mois.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/angers.telandcash/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram TEL & CASH"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#3b82f6] transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.tiktok.com/@telandcash"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok TEL & CASH"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#3b82f6] transition-colors"
              >
                <TikTokIcon className="w-5 h-5" />
              </a>
              <a
                href="https://www.snapchat.com/add/telandcash49"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Snapchat TEL & CASH"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#3b82f6] transition-colors"
              >
                <SnapchatIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">Navigation</h3>
            <ul className="flex flex-col gap-4 text-white/60 text-sm">
              <li><Link href="/" className="hover:text-[#3b82f6] transition-colors">Accueil</Link></li>
              <li><Link href="/products" className="hover:text-[#3b82f6] transition-colors">Smartphones</Link></li>
              <li><Link href="/accessoires" className="hover:text-[#3b82f6] transition-colors">Accessoires</Link></li>
              <li><Link href="/engagements" className="hover:text-[#3b82f6] transition-colors">Nos engagements</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">Services</h3>
            <ul className="flex flex-col gap-4 text-white/60 text-sm">
              <li><Link href="/engagements" className="hover:text-[#3b82f6] transition-colors">Garantie 24 mois</Link></li>
              <li><Link href="/reconditionnement" className="hover:text-[#3b82f6] transition-colors">Le reconditionnement</Link></li>
              <li><Link href="/#faq" className="hover:text-[#3b82f6] transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-[#3b82f6] transition-colors">Nous contacter</Link></li>
            </ul>
          </div>

          {/* Legal & Payments */}
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">Légal & Paiement</h3>
            <ul className="flex flex-col gap-4 text-white/60 text-sm mb-6">
              <li><Link href="/cgv" className="hover:text-[#3b82f6] transition-colors">Conditions générales de vente</Link></li>
              <li><Link href="/confidentialite" className="hover:text-[#3b82f6] transition-colors">Politique de confidentialité</Link></li>
              <li><Link href="/mentions" className="hover:text-[#3b82f6] transition-colors">Mentions légales</Link></li>
            </ul>
            <div className="flex items-center gap-2 opacity-50 grayscale">
              <div className="w-12 h-8 bg-white/20 rounded flex items-center justify-center text-xs font-bold">VISA</div>
              <div className="w-12 h-8 bg-white/20 rounded flex items-center justify-center text-xs font-bold">MC</div>
              <div className="w-12 h-8 bg-white/20 rounded flex items-center justify-center text-xs font-bold">PAYPAL</div>
            </div>
          </div>

        </div>

        <div className="pt-8 border-t border-white/10 text-center text-sm text-white/40 flex flex-col md:flex-row justify-between items-center">
          <p>© {new Date().getFullYear()} Tel & Cash. Tous droits réservés.</p>
          <p className="mt-2 md:mt-0">Fait avec passion en France 🇫🇷</p>
        </div>
      </div>
    </footer>
  );
}
