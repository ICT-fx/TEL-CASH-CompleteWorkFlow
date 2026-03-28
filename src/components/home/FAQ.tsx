'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "La batterie est-elle neuve ?",
      answer: "Les batteries sont testées et doivent présenter une capacité supérieure à 85% de leur charge initiale. Si ce n'est pas le cas, elles sont remplacées par des batteries neuves certifiées avant la mise en vente."
    },
    {
      question: "Comment fonctionne la garantie de 24 mois ?",
      answer: "La garantie couvre tous les dysfonctionnements logiciels et matériels indépendants de votre usage (hors casse, oxydation, ou ouverture par un tiers). Le retour et la réparation sont pris en charge par nos services."
    },
    {
      question: "Puis-je retourner le produit s'il ne me convient pas ?",
      answer: "Oui, vous disposez d'un délai légal de rétractation de 30 jours pour nous renvoyer l'appareil (à condition qu'il soit dans le même état) et obtenir un remboursement intégral."
    },
    {
      question: "Comment choisir le grade esthétique ?",
      answer: "Le Grade A correspond à un état comme neuf (aucune rayure). Le Grade B présente de légères micro-rayures invisibles écran allumé. Le Grade C montre des traces d'usure plus prononcées. Dans tous les cas, l'appareil est 100% fonctionnel."
    },
    {
      question: "Proposez-vous le paiement en plusieurs fois ?",
      answer: "Tout à fait ! Nous passons par notre partenaire Alma pour vous proposer le paiement sécurisé en 3X ou 4X par carte bancaire."
    }
  ];

  return (
    <section className="py-24 bg-white text-[#0A0F1E] overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Newsletter */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-[#0A0F1E] text-white rounded-[2rem] p-10 md:p-14 shadow-2xl relative overflow-hidden h-full"
          >
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#2563EB]/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10">
              {/* Cursive annotation above newsletter title */}
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[#93c5fd] font-['Caveat'] text-xl md:text-2xl -rotate-2 inline-block">
                  en avant-première
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" className="stroke-[#93c5fd] fill-none stroke-[1.5px] opacity-70" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
              </div>

              <Mail className="w-12 h-12 mb-6 text-white/80" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-white">
                Ne manquez aucune bonne affaire !
              </h2>
              <p className="text-white/80 mb-8 text-lg font-medium max-w-md">
                Inscrivez-vous à notre newsletter et recevez nos offres exclusives en avant-première.
              </p>

              <form className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                  type="email"
                  placeholder="Votre adresse email"
                  className="flex-grow rounded-xl px-6 py-4 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner backdrop-blur-md transition-all"
                  required
                />
                <Button className="bg-[#2563eb] text-white hover:bg-blue-700 shadow-xl border-none font-bold">
                  S'inscrire
                </Button>
              </form>

              <p className="text-[10px] text-white/40">
                En vous inscrivant, vous acceptez notre politique de confidentialité. (RGPD)
              </p>
            </div>
          </motion.div>

          {/* Accordion FAQ */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            {/* Annotation + sparkle above FAQ title */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#3b82f6] font-['Caveat'] text-xl md:text-2xl -rotate-2 inline-block">
                vos questions
              </span>
            </div>

            <div className="flex items-center gap-3 mb-8 relative">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-[#0A0F1E]">
                Questions Fréquentes
              </h2>
              {/* Sparkle near title */}
              <svg width="20" height="20" viewBox="0 0 24 24" className="stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-80 animate-pulse shrink-0 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
              </svg>
            </div>

            <div className="flex flex-col gap-[10px]">
              {faqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={index}
                    className={`group transition-all duration-300 rounded-[12px] border overflow-hidden ${
                      isOpen
                        ? "bg-blue-50 border-blue-200 shadow-[inset_3px_0_0_0_#3b82f6]"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:translate-y-[-1px] cursor-pointer"
                    }`}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <button
                      className="w-full text-left px-6 py-5 flex items-center justify-between font-medium text-[15px] md:text-[16px] focus:outline-none"
                    >
                      <span className={isOpen ? "text-blue-600" : "text-[#0A0F1E]"}>{faq.question}</span>
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-300 ${
                          isOpen ? "rotate-180 text-blue-600" : "text-slate-400"
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <div className="px-6 pb-6 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-2">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
