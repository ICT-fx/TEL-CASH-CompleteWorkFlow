// « Caractéristiques techniques » en accordéon FAQ. Source des valeurs :
//   1) override saisi à la main (products.specs) en priorité,
//   2) sinon le dictionnaire iPhone (iphoneSpecs.ts via specsFromIphone).
// Affiché dès qu'une source existe (override OU dictionnaire) → marche désormais
// aussi hors Apple. Aucune source → null (bloc masqué proprement).

import { Smartphone, Cpu, Camera, BatteryFull, ChevronDown, type LucideIcon } from 'lucide-react';
import { specsFromIphone, isSpecsEmpty, SPEC_THEMES, type ProductSpecs } from '@/lib/productSpecs';

interface Props {
  brand: string | null | undefined;
  model: string | null | undefined;
  specs?: ProductSpecs | null;
  warranty?: string | null;
}

interface Row { label: string; value: string }
interface Group { icon: LucideIcon; title: string; rows: Row[] }

const THEME_ICONS: LucideIcon[] = [Smartphone, Cpu, Camera, BatteryFull];

function fmt(v: string | number | null): string {
  if (v == null) return '';
  return typeof v === 'number' ? String(v) : v;
}

export function TechSpecs({ model, specs, warranty }: Props) {
  const override = isSpecsEmpty(specs) ? null : (specs as ProductSpecs);
  const data: ProductSpecs | null = override ?? specsFromIphone(model);
  if (!data) return null;

  const groups: Group[] = SPEC_THEMES.map((theme, i) => ({
    icon: THEME_ICONS[i] ?? Smartphone,
    title: theme.title,
    rows: theme.fields
      .map((f) => ({ label: f.label, value: fmt(data[f.key]) }))
      .filter((r) => r.value.trim() !== ''),
  }));

  // Ligne « Garantie » sous le dernier thème (Autonomie & infos).
  const last = groups[groups.length - 1];
  if (last) {
    last.rows.push({ label: 'Garantie', value: (warranty && warranty.trim()) || '24 mois incluse' });
  }

  const visible = groups.filter((g) => g.rows.length > 0);
  if (visible.length === 0) return null;

  return (
    <section className="mt-12 md:mt-16">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-[22px] font-extrabold text-[#0B1437] tracking-tight">Caractéristiques techniques</h2>
        <span className="font-caveat text-[#4B7BFF] text-base">déroulez ce qui vous intéresse</span>
      </div>
      <div className="h-px bg-[#ECECEC] my-4" />

      <div>
        {visible.map((g, i) => {
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
