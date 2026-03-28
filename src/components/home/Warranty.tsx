'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, Wrench, PhoneCall, Mail, MessageSquare, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export function Warranty() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Cursive annotation */}
            <div className="mb-5">
              <div className="text-[#3b82f6] font-['Caveat'] text-2xl md:text-3xl -rotate-2 inline-block">
                on s'occupe de tout
              </div>
              {/* Clean arc arrow below annotation, well-spaced, pointing toward title */}
              <div className="mt-2 hidden sm:block">
                <svg width="48" height="30" viewBox="0 0 48 30" className="fill-none" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 42 4 C 30 4 10 8 6 22" stroke="#3b82f6" strokeWidth="1.5"/>
                  <path d="M 6 22 L 2 14 M 6 22 L 14 18" stroke="#3b82f6" strokeWidth="1.5"/>
                </svg>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 text-[#0A0F1E] relative">
              Garantie & SAV 100% Français
              {/* Sketched shield near title */}
              <svg width="38" height="38" viewBox="0 0 40 40" className="absolute -top-6 -right-5 stroke-slate-300 fill-none opacity-70 rotate-12 hidden sm:block" style={{strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '1.5px'}}>
                <path d="M 20 5 L 32 10 L 32 20 C 32 28 20 35 20 35 C 20 35 8 28 8 20 L 8 10 Z" />
                <path d="M 12 10 L 28 10 M 12 16 L 28 16 M 15 22 L 25 22" />
              </svg>
            </h2>

            <p className="text-lg text-slate-500 mb-10 leading-relaxed font-medium">
              Nous incluons une garantie commerciale gratuite de 24 mois sur tous nos smartphones et tablettes reconditionnés, car nous avons une confiance absolue en nos process de révision.
            </p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600 border border-emerald-200 shadow-sm">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-[#0A0F1E]">Couverture Totale</h3>
                  <p className="text-slate-500 font-medium">Pannes matérielles, défauts techniques, boutons, caméras, connecteurs. Pièces et main d'œuvre incluses.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 border border-amber-200 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-[#0A0F1E]">Exclusions</h3>
                  <p className="text-slate-500 font-medium">La casse, l'oxydation, et l'usure de la batterie en dessous de 80% de capacité maximale au-delà du 6ème mois.</p>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <Link href="/engagements" className="block mt-8">
                <Button variant="outline" className="px-8 py-4 rounded-xl font-bold border-2 border-[#0A0F1E] text-[#0A0F1E] hover:bg-[#0A0F1E] hover:text-white transition-all shadow-sm">
                  Voir nos engagements
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full relative"
          >
            {/* Reduced height right column */}
            <div className="relative w-full rounded-[2rem] bg-[#0A0F1E] text-white overflow-hidden p-6 md:p-8 shadow-2xl border border-white/10">

              {/* Subtle Gradient Mesh Background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 blur-[80px] rounded-full pointer-events-none -translate-x-1/2 translate-y-1/2" />

              <div className="relative z-10 flex flex-col items-center mb-6 text-center">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-white/20 backdrop-blur-md">
                  <HeartHandshake className="w-6 h-6 text-[#3b82f6]" strokeWidth={1.5} />
                </div>
                <div className="font-['Caveat'] text-[#93c5fd] text-2xl -rotate-2 mb-1">
                  toujours là pour vous
                </div>
                <h3 className="text-2xl font-black mb-1 tracking-tight">SAV Ultra-Réactif</h3>
                <p className="text-white/70 font-medium text-sm max-w-sm">Une équipe humaine à votre écoute en France.</p>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-white leading-tight">01 23 45 67 89</div>
                    <div className="text-xs text-white/60 font-medium">Lundi-Samedi, 9h-19h (Non surtaxé)</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-white leading-tight">contact@tel-cash.fr</div>
                    <div className="text-xs text-white/60 font-medium">Réponse garantie sous 24h ouvrées</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-[#3b82f6]" />
                  </div>
                  <div>
                    <div className="font-bold text-base text-white leading-tight">Assistance en ligne</div>
                    <div className="text-xs text-white/60 font-medium">Pour vos demandes de retour sous garantie</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 relative z-10">
                <Link href="/contact">
                  <Button className="w-full bg-[#3b82f6] text-white hover:bg-blue-600 shadow-xl shadow-blue-500/20 rounded-xl py-5 font-bold text-base">
                    Contacter le support
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
