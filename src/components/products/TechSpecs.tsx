// Étape 4 — « Caractéristiques techniques » en ACCORDÉON FAQ (badge Back Market :
// icône carré bleu clair + titre + chevron qui pivote). Specs regroupées par
// thème, 1ère section ouverte par défaut. Alimenté par src/lib/iphoneSpecs.ts.
// Modèle absent du dictionnaire → renvoie null (masqué proprement).

import { Smartphone, Cpu, Camera, BatteryFull, ChevronDown, type LucideIcon } from 'lucide-react';
import { getIphoneSpecs, type IphoneSpec } from '@/lib/iphoneSpecs';

interface Props {
  brand: string | null | undefined;
  model: string | null | undefined;
}

interface Row {
  label: string;
  value: string;
}
interface Group {
  icon: LucideIcon;
  title: string;
  rows: Row[];
}

function buildGroups(spec: IphoneSpec): Group[] {
  const v = (x: string | number) => (typeof x === 'number' ? String(x) : x);
  return [
    {
      icon: Smartphone,
      title: 'Écran & design',
      rows: [
        { label: 'Écran', value: v(spec.ecran) },
        { label: 'Résistance eau', value: v(spec.resistance) },
        { label: 'Poids', value: v(spec.poids) },
      ],
    },
    {
      icon: Cpu,
      title: 'Performances & réseau',
      rows: [
        { label: 'Puce', value: v(spec.puce) },
        { label: 'Réseau', value: v(spec.reseau) },
        { label: 'Connectique', value: v(spec.connectique) },
      ],
    },
    {
      icon: Camera,
      title: 'Photo & vidéo',
      rows: [
        { label: 'Appareil photo', value: v(spec.photo) },
        { label: 'Caméra avant', value: v(spec.selfie) },
        { label: 'Vidéo', value: v(spec.video) },
      ],
    },
    {
      icon: BatteryFull,
      title: 'Autonomie & infos',
      rows: [
        { label: 'Autonomie', value: v(spec.autonomie) },
        { label: 'Année de sortie', value: v(spec.annee) },
        { label: 'Garantie', value: '24 mois incluse' },
      ],
    },
  ];
}

export function TechSpecs({ brand, model }: Props) {
  if (!brand || brand.trim().toLowerCase() !== 'apple') return null;
  const spec = getIphoneSpecs(model);
  if (!spec) return null;

  const groups = buildGroups(spec);

  return (
    <section className="mt-12 md:mt-16">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-[22px] font-extrabold text-[#0B1437] tracking-tight">Caractéristiques techniques</h2>
        <span className="font-caveat text-[#4B7BFF] text-base">déroulez ce qui vous intéresse</span>
      </div>
      <div className="h-px bg-[#ECECEC] my-4" />

      <div>
        {groups.map((g, i) => {
          const Icon = g.icon;
          const summary = g.rows.map((r) => r.value).join(' · ');
          return (
            <details
              key={g.title}
              open={i === 0}
              className="group border border-[#E8E8E8] open:border-[#D6DEF0] rounded-[14px] bg-white mb-2.5 overflow-hidden"
            >
              <summary className="list-none cursor-pointer flex items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="w-10 h-10 rounded-[11px] bg-[#EBF1FF] text-[#2F6BFF] flex items-center justify-center flex-none">
                  <Icon className="w-[21px] h-[21px]" strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-extrabold text-[#0B1437] leading-tight">{g.title}</span>
                  <span className="block text-xs text-[#9AA3B2] mt-0.5 truncate">{summary}</span>
                </span>
                <ChevronDown className="w-5 h-5 text-[#B6BCC7] flex-none transition-transform duration-200 group-open:rotate-180 group-open:text-[#2F6BFF]" />
              </summary>
              <div className="px-4 pb-2 pl-4 md:pl-[69px]">
                {g.rows.map((r) => (
                  <div key={r.label} className="flex justify-between items-center gap-3.5 py-2.5 border-t border-[#F1F1F1]">
                    <span className="text-[13px] text-[#8A92A0] flex-none">{r.label}</span>
                    <b className="text-[13px] font-extrabold text-[#0B1437] text-right">{r.value}</b>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <p className="text-[11px] text-[#9AA3B2] mt-3.5">
        Caractéristiques fabricant — peuvent évoluer suivant les versions logicielles.
      </p>
    </section>
  );
}
