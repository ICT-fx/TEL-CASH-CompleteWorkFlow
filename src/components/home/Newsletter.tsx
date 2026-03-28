import { Mail } from 'lucide-react';

export function Newsletter() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-gradient-to-br from-[#3b82f6] to-[#2563eb] rounded-3xl p-8 md:p-14 shadow-lg flex flex-col items-start gap-6 relative overflow-hidden">
          
          {/* Subtle light effect on the gradient */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3"></div>

          {/* Mail Icon */}
          <div className="w-14 h-14 rounded-2xl border-2 border-white/80 flex items-center justify-center bg-transparent mb-2 z-10">
            <Mail className="w-7 h-7 text-white stroke-[1.5]" />
          </div>

          <div className="max-w-2xl relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-[1.15] tracking-tight">
              Ne manquez aucune bonne affaire !
            </h2>
            <p className="text-white/95 text-base md:text-[17px] font-medium leading-relaxed max-w-xl">
              Inscrivez-vous à notre newsletter et recevez nos offres exclusives en avant-première, ainsi qu'un code promo de -10€ sur votre première commande.
            </p>
          </div>

          <div className="w-full mt-2 relative z-10">
            <form className="flex flex-col sm:flex-row gap-4 w-full" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Votre adresse email"
                className="flex-1 bg-white text-slate-900 px-6 py-4 rounded-xl outline-none placeholder:text-slate-400 font-medium shadow-sm transition-shadow focus:ring-4 focus:ring-white/30"
                required
              />
              <button
                type="submit"
                className="bg-white text-black font-bold px-8 py-4 rounded-xl hover:bg-slate-50 transition-colors shadow-md sm:w-auto w-full text-base"
              >
                S'inscrire
              </button>
            </form>
            <p className="text-white/70 text-xs mt-5 leading-normal max-w-2xl font-medium">
              En vous inscrivant, vous acceptez notre politique de confidentialité. Vous pouvez vous désincrire à tout moment. (RGPD)
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
