// Skeleton affiché INSTANTANÉMENT pendant le rendu serveur de la fiche produit
// (2 requêtes Supabase). Sans cette frontière de chargement, le clic semblait
// « bloqué » ~1 s (et poussait à cliquer 2 fois). Next affiche ce squelette dès
// la navigation puis remplace par la vraie fiche quand les données arrivent.
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F9F8F5] animate-pulse">
      <div className="container mx-auto px-4 max-w-7xl pt-24 pb-16">
        {/* Fil d'Ariane / retour */}
        <div className="h-4 w-40 rounded bg-slate-200 mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-16">
          {/* Visuel produit */}
          <div className="rounded-[32px] bg-white border border-slate-200/60 shadow-sm h-[280px] sm:h-[420px] lg:h-[520px] flex items-center justify-center">
            <div className="h-3/4 w-2/5 rounded-3xl bg-slate-200" />
          </div>

          {/* Détails produit */}
          <div className="flex flex-col gap-4 pt-2">
            <div className="h-6 w-32 rounded-full bg-slate-200" />
            <div className="h-9 w-3/4 rounded-lg bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-5/6 rounded bg-slate-200" />
            <div className="h-10 w-32 rounded-lg bg-slate-200 mt-2" />

            {/* Sélecteurs */}
            <div className="flex gap-3 mt-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-7 w-7 rounded-full bg-slate-200" />
              ))}
            </div>

            <div className="h-28 w-full rounded-xl bg-slate-200 mt-4" />
            <div className="h-12 w-full rounded-xl bg-slate-300 mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
