'use client';

import { useEffect, useState } from 'react';
import {
  DollarSign, ShoppingBag, Wallet, UserPlus, TrendingUp, ExternalLink,
  Users, Eye, Activity, Percent, Smartphone, Monitor, Tablet,
} from 'lucide-react';
import { StatTile } from '@/components/admin/ui/StatTile';
import { MiniBarChart } from '@/components/admin/ui/MiniBarChart';
import { normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

interface ProductRef {
  brand: string | null;
  model: string | null;
  storage_capacity: string | null;
  grade: string | null;
  color: string | null;
}
interface TopProduct {
  product: ProductRef | null;
  fallbackName: string | null;
  qty: number;
  revenue: number;
}
interface Stats {
  revenueCurrent: number;
  revenuePrevious: number;
  revenueDelta: number | null;
  ordersCurrent: number;
  avgBasket: number;
  uniqueBuyers: number;
  newCustomers: number;
}
interface Traffic {
  uniqueVisitors: number;
  visitorsDelta: number | null;
  pageViews: number;
  sessions: number;
  conversionRate: number | null;
  visitsByDay: { date: string; total: number }[];
  topPages: { path: string; views: number }[];
  sources: { direct: number; google: number; social: number; other: number };
  devices: { mobile: number; desktop: number; tablet: number; unknown: number };
}

const PERIODS = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
  { key: '365', label: '12 mois' },
];

// Liens externes (gardés en petit en bas) — les chiffres de trafic sont
// désormais affichés directement, lus depuis notre table page_views.
const UMAMI_DASHBOARD_URL = 'https://cloud.umami.is/websites/c86da298-85af-468e-9451-928fc9cd493a';
const VERCEL_ANALYTICS_URL = 'https://vercel.com/dashboard';

function euro(n: number): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
}
function intFr(n: number): string {
  return n.toLocaleString('fr-FR');
}

function productLabel(p: TopProduct): string {
  if (!p.product) return p.fallbackName || 'Produit inconnu';
  const grade = normalizeGradeLetter(p.product.grade);
  return [
    [p.product.brand, p.product.model].filter(Boolean).join(' '),
    p.product.storage_capacity || null,
    grade ? `Grade ${grade}` : null,
    p.product.color ? colorLabelFr(p.product.color) : null,
  ].filter(Boolean).join(' · ') || (p.fallbackName ?? 'Produit inconnu');
}

// Ligne « libellé — barre — valeur (%) » réutilisée pour sources/devices/pages.
function BreakdownRow({ label, value, total, color = '#3b82f6' }: {
  label: React.ReactNode; value: number; total: number; color?: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <div style={{ width: 110, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span style={{ width: 86, textAlign: 'right', fontSize: '0.8rem', color: '#0f172a', flexShrink: 0 }}>
        {intFr(value)} <span style={{ color: '#94a3b8' }}>({pct.toFixed(0)} %)</span>
      </span>
    </div>
  );
}

export default function AdminStatsPage() {
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState<Stats | null>(null);
  const [salesByDay, setSalesByDay] = useState<{ date: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats/detailed?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setSalesByDay(d.salesByDay || []);
        setTopProducts(d.topProducts || []);
        setTraffic(d.traffic || null);
        setGranularity(d.granularity || 'day');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';
  const maxRevenue = topProducts.length ? topProducts[0].revenue || 1 : 1;

  const sourceTotal = traffic
    ? traffic.sources.direct + traffic.sources.google + traffic.sources.social + traffic.sources.other
    : 0;
  const deviceTotal = traffic
    ? traffic.devices.mobile + traffic.devices.desktop + traffic.devices.tablet + traffic.devices.unknown
    : 0;
  const maxPageViews = traffic && traffic.topPages.length ? traffic.topPages[0].views || 1 : 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>
            Statistiques
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Ventes & trafic sur la période sélectionnée
          </p>
        </div>
        {/* Sélecteur de période */}
        <div className="tabs-wrap" style={{ display: 'inline-flex' }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`tab ${period === p.key ? 'active' : ''}`}
              onClick={() => setPeriod(p.key)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── COMMERCE ─────────────────────────────────────────── */}
          {stats && (
            <div className="admin-kpi-grid" style={{ marginBottom: 16 }}>
              <StatTile
                label="Chiffre d'affaires"
                value={euro(stats.revenueCurrent)}
                delta={stats.revenueDelta}
                hint={stats.revenueDelta == null ? `sur ${periodLabel}` : 'vs période précédente'}
                accent="#1d4ed8"
                icon={<DollarSign className="w-4 h-4" />}
              />
              <StatTile
                label="Commandes"
                value={String(stats.ordersCurrent)}
                hint={`${stats.uniqueBuyers} client${stats.uniqueBuyers > 1 ? 's' : ''} acheteur${stats.uniqueBuyers > 1 ? 's' : ''}`}
                icon={<ShoppingBag className="w-4 h-4" />}
              />
              <StatTile
                label="Panier moyen"
                value={euro(stats.avgBasket)}
                hint={`sur ${periodLabel}`}
                icon={<Wallet className="w-4 h-4" />}
              />
              <StatTile
                label="Nouveaux clients"
                value={String(stats.newCustomers)}
                hint={`inscrits sur ${periodLabel}`}
                icon={<UserPlus className="w-4 h-4" />}
              />
            </div>
          )}

          {/* Évolution du CA */}
          <div className="admin-ui-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 500, color: '#0f172a' }}>
                {granularity === 'month' ? 'Chiffre d\'affaires par mois' : `Chiffre d'affaires — ${periodLabel}`}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 500, color: '#1d4ed8' }}>
                {euro(salesByDay.reduce((s, d) => s + d.total, 0))}
              </div>
            </div>
            <MiniBarChart data={salesByDay} />
          </div>

          {/* Top produits */}
          <div className="admin-ui-card" style={{ padding: 18, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#15803d' }} />
              <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a' }}>
                Top produits (par chiffre d&apos;affaires)
              </div>
            </div>
            {topProducts.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>
                Aucune vente sur cette période
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topProducts.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 18, fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {productLabel(p)}
                    </span>
                    <div style={{ width: 110, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${(p.revenue / maxRevenue) * 100}%`, height: '100%', background: '#3b82f6' }} />
                    </div>
                    <span style={{ width: 56, textAlign: 'right', fontSize: '0.78rem', color: '#64748b', flexShrink: 0 }}>
                      {p.qty} vendu{p.qty > 1 ? 's' : ''}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', flexShrink: 0 }}>
                      {euro(p.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── TRAFIC ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 500, color: '#0f172a' }}>Trafic</h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>— audience du site</span>
          </div>

          {!traffic ? (
            <div className="admin-ui-card" style={{ padding: 18, marginBottom: 16 }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                Le tracking de trafic n&apos;est pas encore actif. Appliquez la migration
                <strong> 032_page_views </strong> sur Supabase : les visites seront enregistrées
                à partir de ce moment-là et s&apos;afficheront ici.
              </p>
            </div>
          ) : (
            <>
              <div className="admin-kpi-grid" style={{ marginBottom: 16 }}>
                <StatTile
                  label="Visiteurs uniques"
                  value={intFr(traffic.uniqueVisitors)}
                  delta={traffic.visitorsDelta}
                  hint={traffic.visitorsDelta == null ? `sur ${periodLabel}` : 'vs période précédente'}
                  accent="#7c3aed"
                  icon={<Users className="w-4 h-4" />}
                />
                <StatTile
                  label="Pages vues"
                  value={intFr(traffic.pageViews)}
                  hint={`${intFr(traffic.sessions)} session${traffic.sessions > 1 ? 's' : ''}`}
                  icon={<Eye className="w-4 h-4" />}
                />
                <StatTile
                  label="Sessions"
                  value={intFr(traffic.sessions)}
                  hint={`sur ${periodLabel}`}
                  icon={<Activity className="w-4 h-4" />}
                />
                <StatTile
                  label="Taux de conversion"
                  value={traffic.conversionRate == null ? '—' : `${traffic.conversionRate.toFixed(1)} %`}
                  hint="commandes payées / visiteurs"
                  accent="#15803d"
                  icon={<Percent className="w-4 h-4" />}
                />
              </div>

              {/* Évolution des visites */}
              <div className="admin-ui-card" style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 500, color: '#0f172a' }}>
                    {granularity === 'month' ? 'Pages vues par mois' : `Pages vues — ${periodLabel}`}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 500, color: '#7c3aed' }}>
                    {intFr(traffic.visitsByDay.reduce((s, d) => s + d.total, 0))}
                  </div>
                </div>
                <MiniBarChart
                  data={traffic.visitsByDay}
                  ariaLabel="Pages vues sur la période"
                  valueFormatter={(n) => `${intFr(n)} vue${n > 1 ? 's' : ''}`}
                />
              </div>

              <div className="admin-grid-2" style={{ marginBottom: 16 }}>
                {/* Sources de trafic */}
                <div className="admin-ui-card" style={{ padding: 18 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a', marginBottom: 14 }}>
                    Sources de trafic
                  </div>
                  {sourceTotal === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>Aucune visite</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <BreakdownRow label="Direct" value={traffic.sources.direct} total={sourceTotal} color="#64748b" />
                      <BreakdownRow label="Google" value={traffic.sources.google} total={sourceTotal} color="#ea4335" />
                      <BreakdownRow label="Réseaux sociaux" value={traffic.sources.social} total={sourceTotal} color="#2563eb" />
                      <BreakdownRow label="Autres sites" value={traffic.sources.other} total={sourceTotal} color="#a855f7" />
                    </div>
                  )}
                </div>

                {/* Appareils */}
                <div className="admin-ui-card" style={{ padding: 18 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a', marginBottom: 14 }}>
                    Appareils
                  </div>
                  {deviceTotal === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>Aucune visite</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <BreakdownRow label={<><Smartphone className="w-3.5 h-3.5" /> Mobile</>} value={traffic.devices.mobile} total={deviceTotal} color="#0ea5e9" />
                      <BreakdownRow label={<><Monitor className="w-3.5 h-3.5" /> Ordinateur</>} value={traffic.devices.desktop} total={deviceTotal} color="#6366f1" />
                      <BreakdownRow label={<><Tablet className="w-3.5 h-3.5" /> Tablette</>} value={traffic.devices.tablet} total={deviceTotal} color="#14b8a6" />
                      {traffic.devices.unknown > 0 && (
                        <BreakdownRow label="Inconnu" value={traffic.devices.unknown} total={deviceTotal} color="#cbd5e1" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Top pages */}
              <div className="admin-ui-card" style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a', marginBottom: 14 }}>
                  Pages les plus vues
                </div>
                {traffic.topPages.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>Aucune visite</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {traffic.topPages.map((pg, i) => (
                      <div key={pg.path} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 18, fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', color: '#0f172a', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pg.path}
                        </span>
                        <div style={{ width: 110, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ width: `${(pg.views / maxPageViews) * 100}%`, height: '100%', background: '#7c3aed' }} />
                        </div>
                        <span style={{ width: 72, textAlign: 'right', fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', flexShrink: 0 }}>
                          {intFr(pg.views)} vue{pg.views > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Liens externes (comparaison/sauvegarde) — discrets, en bas. */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
            <a href={UMAMI_DASHBOARD_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: '#94a3b8', textDecoration: 'none' }}>
              Comparer sur Umami <ExternalLink className="w-3 h-3" />
            </a>
            <a href={VERCEL_ANALYTICS_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: '#94a3b8', textDecoration: 'none' }}>
              Comparer sur Vercel <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
