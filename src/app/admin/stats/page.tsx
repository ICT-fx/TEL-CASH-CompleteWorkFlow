'use client';

import { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, Wallet, UserPlus, TrendingUp } from 'lucide-react';
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

const PERIODS = [
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
  { key: '365', label: '12 mois' },
];

function euro(n: number): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
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

export default function AdminStatsPage() {
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState<Stats | null>(null);
  const [salesByDay, setSalesByDay] = useState<{ date: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
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
        setGranularity(d.granularity || 'day');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';
  const maxRevenue = topProducts.length ? topProducts[0].revenue || 1 : 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>
            Statistiques
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Performances commerciales sur la période sélectionnée
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
          {/* KPIs */}
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
          <div className="admin-ui-card" style={{ padding: 18 }}>
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
        </>
      )}
    </div>
  );
}
