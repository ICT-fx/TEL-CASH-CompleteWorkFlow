// Tableau "Caractéristiques techniques" alimenté par src/lib/iphoneSpecs.ts.
// Si le modèle n'a pas de fiche → renvoie null pour que la page n'affiche
// pas un bloc vide (la consigne explicite : "masque proprement").

import { getIphoneSpecs, SPEC_ROWS } from '@/lib/iphoneSpecs';

interface Props {
  brand: string | null | undefined;
  model: string | null | undefined;
}

export function TechSpecs({ brand, model }: Props) {
  // Seules les fiches Apple sont câblées pour l'instant. Quand on ajoutera des
  // specs Samsung/Xiaomi/Google, élargir la garde ici.
  if (!brand || brand.trim().toLowerCase() !== 'apple') return null;

  const spec = getIphoneSpecs(model);
  if (!spec) return null;

  return (
    <section className="mt-12 md:mt-16">
      <h2 className="text-xl md:text-2xl font-black text-[#0A0F1E] mb-5 flex items-center gap-3">
        Caractéristiques techniques
        <div className="h-0.5 flex-grow bg-slate-100" />
      </h2>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <dl className="divide-y divide-slate-50">
          {SPEC_ROWS.map(({ key, label }) => {
            const raw = spec[key];
            const value = typeof raw === 'number' ? String(raw) : raw;
            const isTbd = !value || value === 'À confirmer';
            return (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 sm:px-5 py-3.5"
              >
                <dt className="text-xs sm:text-sm font-bold text-slate-500 sm:w-1/3 flex-shrink-0">
                  {label}
                </dt>
                <dd
                  className={`text-sm sm:text-base text-right sm:text-left flex-grow break-words ${
                    isTbd ? 'italic text-slate-400' : 'font-semibold text-[#0A0F1E]'
                  }`}
                >
                  {value || 'À confirmer'}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Caractéristiques fabricant — peuvent évoluer suivant les versions logicielles.
      </p>
    </section>
  );
}
