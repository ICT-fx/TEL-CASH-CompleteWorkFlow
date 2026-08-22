// Géométrie + libellés d'axe du graphique de ventes — extrait de MiniBarChart
// pour être testable sans rendre du SVG. Valeurs de mise en page reprises au
// pixel près de la maquette approuvée (direction "Vitrine", 1c) :
// viewBox 1080x190, ligne de base y=150.5, rx=4.

export interface BarDatum {
  date: string; // YYYY-MM-DD
  total: number;
}

export interface BarLayoutItem {
  date: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  cx: number; // centre horizontal, pour positionner le texte
  dateLabel: string;
  showLabel: boolean;
  tooltip: string;
}

const VIEW_W = 1080;
const BASELINE_Y = 150.5;
const BAR_AREA_H = 148; // du haut utile (y≈2.5) à la ligne de base
const GAP = 6;
const MIN_H = 3;
const COLOR_VALUE = '#2F6BFF';
const COLOR_ZERO = '#EDEDEA';

function eur(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// "23 juil.", "1 août", "15" (jour seul si ni bord ni tout début de mois).
function formatAxisLabel(iso: string, isFirst: boolean, isLast: boolean): string {
  const d = new Date(iso + 'T00:00:00Z');
  const day = d.getUTCDate();
  const withMonth = isFirst || isLast || day <= 3;
  if (!withMonth) return String(day);
  const month = d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });
  // "août" ne prend pas de point abréviatif (déjà court) ; les autres mois si.
  const monthLabel = month.endsWith('.') || month === 'août' ? month : `${month}.`;
  return `${day} ${monthLabel}`;
}

function formatTooltipDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function buildBarLayout(data: BarDatum[], opts: { labelEvery?: number } = {}): BarLayoutItem[] {
  if (!data || data.length === 0) return [];
  const labelEvery = opts.labelEvery ?? 3;
  const n = data.length;
  const barW = (VIEW_W - GAP * (n - 1)) / n;
  const max = Math.max(1, ...data.map((d) => d.total));

  return data.map((d, i) => {
    const h = d.total > 0 ? Math.max(MIN_H, (d.total / max) * BAR_AREA_H) : MIN_H;
    const isZero = d.total <= 0;
    const x = i * (barW + GAP);
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const showLabel = isFirst || isLast || i % labelEvery === 0;
    return {
      date: d.date,
      x,
      y: BASELINE_Y - h,
      w: barW,
      h,
      fill: isZero ? COLOR_ZERO : COLOR_VALUE,
      cx: x + barW / 2,
      dateLabel: formatAxisLabel(d.date, isFirst, isLast),
      showLabel,
      tooltip: `${formatTooltipDate(d.date)} — ${eur(d.total)}`,
    };
  });
}
