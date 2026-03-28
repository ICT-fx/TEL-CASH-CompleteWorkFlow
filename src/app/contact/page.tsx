'use client';

import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, Sparkles, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

export default function ContactPage() {
  const [formState, setFormState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('sending');
    setTimeout(() => {
      setFormState('sent');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5]">
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-[#0A0F1E] text-white relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="container mx-auto px-4 max-w-7xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#93c5fd] font-['Caveat'] text-2xl md:text-3xl -rotate-2">
                on s'occupe de vous
              </span>
              <Sparkles className="w-5 h-5 text-yellow-400 opacity-60 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-6 relative">
              Contactez le Support
            </h1>
            <p className="text-xl text-white/60 max-w-2xl font-medium leading-relaxed">
              Une question sur une commande ? Besoin d'aide pour choisir ? Notre équipe locale basée à Angers vous répond en direct.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-7xl py-12 md:py-24 -mt-12 md:-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Left: Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[32px] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100"
          >
            {formState === 'sent' ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-black text-[#0A0F1E] mb-4">Message envoyé !</h3>
                <p className="text-slate-500 font-medium">Merci de nous avoir contactés. Nous vous répondrons sous 24h ouvrées.</p>
                <Button 
                  variant="outline"
                  onClick={() => setFormState('idle')}
                  className="mt-8 px-8 py-3 rounded-xl border-2 border-slate-100 font-bold"
                >
                  Envoyer un autre message
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-black text-[#0A0F1E] mb-8 tracking-tight">Envoyez-nous un message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Nom complet</label>
                      <input required type="text" placeholder="Jean Dupont" className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-100 px-6 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Email</label>
                      <input required type="email" placeholder="jean@email.com" className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-100 px-6 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">N° de commande (optionnel)</label>
                    <input type="text" placeholder="#TC-12345" className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-100 px-6 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Votre message</label>
                    <textarea required placeholder="Comment pouvons-nous vous aider ?" className="w-full min-h-[160px] rounded-2xl bg-slate-50 border border-slate-100 p-6 font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none" />
                  </div>
                  <Button 
                    disabled={formState === 'sending'}
                    className="w-full py-8 text-xl font-black bg-[#3b82f6] hover:bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                  >
                    {formState === 'sending' ? 'Envoi en cours...' : (
                      <>
                        Envoyer le message
                        <Send className="w-6 h-6" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </motion.div>

          {/* Right: Info Cards */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col gap-8 justify-center"
          >
            {/* Info Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { icon: <Phone className="w-6 h-6" />, title: "Par téléphone", val: "01 23 45 67 89", detail: "Lundi-Samedi, 9h-19h" },
                { icon: <Mail className="w-6 h-6" />, title: "Par email", val: "contact@tel-cash.fr", detail: "Réponse sous 24h" },
                { icon: <MapPin className="w-6 h-6" />, title: "En boutique", val: "Angers, Maine-et-Loire", detail: "Pas un entrepôt, une boutique" },
                { icon: <Clock className="w-6 h-6" />, title: "Horaires", val: "9h - 19h", detail: "Fermé le Dimanche" },
              ].map((item, i) => (
                <div key={i} className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    {item.icon}
                  </div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{item.title}</h3>
                  <div className="text-xl font-black text-[#0A0F1E] mb-1">{item.val}</div>
                  <div className="text-sm text-slate-500 font-medium">{item.detail}</div>
                </div>
              ))}
            </div>

            {/* DA Elements */}
            <div className="bg-blue-500 text-white rounded-[32px] p-8 md:p-12 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <MessageSquare className="w-24 h-24 rotate-12" />
              </div>
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-white font-['Caveat'] text-2xl -rotate-2">
                    toujours là pour vous
                  </span>
                </div>
                <h3 className="text-3xl font-black tracking-tight leading-none mb-2">Un problème après l'achat ?</h3>
                <p className="text-white/80 font-medium text-lg mb-6 leading-relaxed">
                  Notre équipe technique est à votre disposition pour toute demande de SAV ou de retour sous garantie. Votre satisfaction est notre priorité.
                </p>
                <div className="h-0.5 w-12 bg-white/30 rounded-full" />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
