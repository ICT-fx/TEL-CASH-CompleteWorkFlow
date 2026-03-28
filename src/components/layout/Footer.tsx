import Link from 'next/link';
import { Instagram, Facebook, Twitter } from 'lucide-react';

const GMAPS_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2700.4!2d-0.5521073!3d47.4734511!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x480879224532671b%3A0x482a7e7aeb686dcb!2sTel%20and%20Cash%20Angers!5e0!3m2!1sfr!2sfr!4v1711630000000!5m2!1sfr!2sfr";

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
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#3b82f6] transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#3b82f6] transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#3b82f6] transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">Navigation</h3>
            <ul className="flex flex-col gap-4 text-white/60 text-sm">
              <li><Link href="/" className="hover:text-[#3b82f6] transition-colors">Accueil</Link></li>
              <li><Link href="/products" className="hover:text-[#3b82f6] transition-colors">Smartphones</Link></li>
              <li><Link href="/products" className="hover:text-[#3b82f6] transition-colors">Accessoires</Link></li>
              <li><Link href="/engagements" className="hover:text-[#3b82f6] transition-colors">Nos engagements</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">Services</h3>
            <ul className="flex flex-col gap-4 text-white/60 text-sm">
              <li><Link href="/engagements" className="hover:text-[#3b82f6] transition-colors">Garantie 24 mois</Link></li>
              <li><Link href="/faq" className="hover:text-[#3b82f6] transition-colors">FAQ</Link></li>
              <li><Link href="/avis-clients" className="hover:text-[#3b82f6] transition-colors">Avis clients</Link></li>
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
