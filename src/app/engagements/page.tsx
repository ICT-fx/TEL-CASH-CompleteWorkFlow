'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Truck, Recycle, HeartHandshake, CheckCircle2, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function EngagementsPage() {
  const engagements = [
    {
      id: 'garantie',
      title: "Garantie 24 mois",
      description: "Ce qu'elle couvre, comment l'activer",
      content: "Chaque smartphone Tel & Cash est couvert par une garantie commerciale de 24 mois. Elle couvre toutes les pannes matérielles (boutons, micro, haut-parleurs, écran, connecteurs) apparaissant lors d'une utilisation normale. En cas de problème, nous réparons ou remplaçons votre appareil en moins de 7 jours ouvrés.",
      icon: <ShieldCheck className="w-12 h-12 text-blue-500" />,
      bg: "bg-[#F9F8F5]"
    },
    {
      id: 'retour',
      title: "Retour 30 jours",
      description: "Satisfait ou remboursé, sans questions",
      content: "Vous disposez de 30 jours pour tester votre nouvel appareil. S'il ne vous convient pas, vous pouvez nous le renvoyer gratuitement. Nous procéderons au remboursement intégral dès réception, à condition que le téléphone soit dans son état d'origine.",
      icon: <Truck className="w-12 h-12 text-blue-500" />,
      bg: "bg-white"
    },
    {
      id: 'responsable',
      title: "Reconditionnement responsable",
      description: "Impact environnemental & seconde vie",
      content: "Acheter chez nous, c'est économiser en moyenne 80kg de CO2 et 164kg de matières premières. Nous privilégions les circuits courts et chaque pièce remplacée est recyclée via des filières spécialisées.",
      icon: <Recycle className="w-12 h-12 text-blue-500" />,
      bg: "bg-[#F9F8F5]"
    },
    {
      id: 'sav',
      title: "SAV 100% Français",
      description: "Équipe locale, réactivité maximale",
      content: "Pas de plateforme à l'autre bout du monde. Notre SAV est basé à Angers. Vous parlez à des experts qui connaissent votre commande et votre appareil. Nous répondons à tous vos emails en moins de 24h.",
      icon: <HeartHandshake className="w-12 h-12 text-blue-500" />,
      bg: "bg-white"
    },
    {
      id: 'certification',
      title: "Certification 60 points",
      description: "Les 60 points de contrôle",
      content: "Chaque téléphone subit une batterie de tests rigoureux : batterie, WiFi, Bluetooth, micro, haut-parleur, caméras, Face ID, écran tactile, connecteur de charge... Rien n'est laissé au hasard pour une expérience identique au neuf.",
      icon: <CheckCircle2 className="w-12 h-12 text-blue-500" />,
      bg: "bg-[#F9F8F5]"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-[#0A0F1E] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#3b82f6]/10 blur-[120px] rounded-full pointer-events-none translate-x-1/3 -translate-y-1/3" />
        
        <div className="container mx-auto px-4 max-w-7xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#93c5fd] font-['Caveat'] text-2xl md:text-3xl -rotate-2">
                notre promesse
              </span>
              <Sparkles className="w-5 h-5 text-yellow-400 opacity-60 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-6 relative">
              Nos Engagements
            </h1>
            <p className="text-xl text-white/60 max-w-2xl font-medium leading-relaxed">
              Nous ne vendons pas seulement des téléphones. Nous garantissons une tranquillité d'esprit totale et un service de proximité.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Engagements List */}
      <div className="flex flex-col">
        {engagements.map((item, index) => (
          <section key={item.id} className={`py-24 md:py-32 ${item.bg} relative overflow-hidden`}>
            <div className="container mx-auto px-4 max-w-7xl">
              <div className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-16 md:gap-24`}>
                
                {/* Visual side */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="w-full md:w-1/2 flex justify-center relative"
                >
                  <div className="relative">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-slate-100 relative z-10">
                      {item.icon}
                    </div>
                    {/* DA Sparkle */}
                    <div className="absolute -top-6 -right-6">
                      <Sparkles className="w-12 h-12 text-blue-500 opacity-20" />
                    </div>
                    {/* Wavy circle background */}
                    <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full scale-150" />
                  </div>
                </motion.div>

                {/* Text Side */}
                <motion.div 
                  initial={{ opacity: 0, x: index % 2 === 0 ? 30 : -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="w-full md:w-1/2"
                >
                  <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-600 font-bold text-[10px] tracking-widest uppercase mb-6">
                    ✦ Engagement n°{index + 1}
                  </div>
                  <div className="mb-2">
                    <span className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-1 inline-block">
                      {item.description}
                    </span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-[#0A0F1E] mb-6 tracking-tight leading-none">
                    {item.title}
                  </h2>
                  <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-8">
                    {item.content}
                  </p>
                  
                  {/* DA Arrow */}
                  <svg width="48" height="32" viewBox="0 0 48 32" className="fill-none opacity-40 mb-4" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                    <path d="M 6 4 C 14 4 34 8 36 24" stroke="#3b82f6" strokeWidth="1.5"/>
                    <path d="M 36 24 L 32 16 M 36 24 L 40 20" stroke="#3b82f6" strokeWidth="1.5"/>
                  </svg>
                </motion.div>

              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Final CTA */}
      <section className="py-24 bg-[#3b82f6] text-white text-center relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter">Prêt à faire le saut ?</h2>
          <p className="text-xl text-white/80 mb-12 font-medium">Rejoignez les milliers de clients qui ont choisi Tel & Cash pour leur prochain smartphone.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/products">
              <Button className="bg-white text-[#3b82f6] hover:bg-slate-50 px-12 py-6 rounded-2xl font-black text-xl shadow-2xl">
                Voir le catalogue
              </Button>
            </Link>
            <Link href="/contact" className="text-white font-bold flex items-center gap-2 group">
              Une question ? <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
