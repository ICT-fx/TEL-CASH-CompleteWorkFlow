'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Truck, Package, Users, AlertTriangle, ArrowRight, TrendingUp,
  ShoppingCart, ChevronRight,
} from 'lucide-react';
import { StatTile } from '@/components/admin/ui/StatTile';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { EntityCard } from '@/components/admin/ui/EntityCard';
import { MiniBarChart } from '@/components/admin/ui/MiniBarChart';
import { Avatar } from '@/components/admin/ui/Avatar';
import { normalizeGradeLetter } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

interface LowStockItem {
  id: string;
  brand: string | null;
  model: string | null;
  stock: number;
  storage_capacity: string | null;
  color: string | null;
  grade: string | null;
}

function lowStockLabel(p: LowStockItem): string {
  const grade = normalizeGradeLetter(p.grade);
  return [
    [p.brand, p.model].filter(Boolean).join(' '),
    p.storage_capacity || null,
    grade ? `Grade ${grade}` : null,
    p.color ? colorLabelFr(p.color) : null,
  ].filter(Boolean).join(' · ');
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [salesByDay, setSalesByDay] = useState<{ date: string; total: number }[]>([]);
  const [topModels, setTopModels] = useState<{ name: string; qty: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d.stats);
        setRecentOrders(d.recentOrders || []);
        setLowStock(d.lowStock || []);
        setSalesByDay(d.salesByDay || []);
        setTopModels(d.topModels || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sales30 = salesByDay.reduce((s, d) => s + d.total, 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>
          Tableau de bord
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>Vue d&apos;ensemble de votre activité</p>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="admin-kpi-grid" style={{ marginBottom: 16 }}>
          <StatTile
            label="Chiffre d'affaires"
            value={`${stats.totalRevenue?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
            delta={stats.revenueDelta}
            hint={stats.revenueDelta == null ? `${stats.paidOrders} commandes payées` : 'vs 30 j précédents'}
            accent="#1d4ed8"
            icon={<DollarSign className="w-4 h-4" />}
          />
          <StatTile
            label="À expédier"
            value={String(stats.paidOrders)}
            hint="commandes payées à traiter"
            icon={<Truck className="w-4 h-4" />}
          />
          <StatTile
            label="Produits actifs"
            value={String(stats.totalProducts)}
            hint={`${lowStock.length} en stock faible`}
            icon={<Package className="w-4 h-4" />}
          />
          <StatTile
            label="Clients"
            value={String(stats.totalUsers)}
            hint={`${stats.totalOrders} commandes au total`}
            icon={<Users className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Paniers (checkout lancé, paiement non finalisé) — point d'entrée vers
          la liste détaillée. Permet de comparer paniers vs commandes payées. */}
      {stats && (() => {
        const carts = stats.pendingOrders || 0;
        const paid = stats.paidOrdersTotal || 0;
        const conv = paid + carts > 0 ? Math.round((paid / (paid + carts)) * 100) : null;
        return (
          <EntityCard href="/admin/carts" padding="14px 18px" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: '#fef3c7', color: '#b45309',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0f172a' }}>Paniers</div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  Checkout lancé, paiement non finalisé
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#b45309', lineHeight: 1.1 }}>{carts}</div>
                {conv != null && (
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {paid} payés · {conv}% convertis
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4" style={{ flexShrink: 0, color: '#cbd5e1' }} />
            </div>
          </EntityCard>
        );
      })()}

      {/* Sales chart */}
      <div className="admin-ui-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 500, color: '#0f172a' }}>
            Ventes des 30 derniers jours
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 500, color: '#1d4ed8' }}>
            {sales30.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
          </div>
        </div>
        <MiniBarChart data={salesByDay} />
      </div>

      <div className="admin-grid-2" style={{ marginBottom: 16 }}>
        {/* Recent orders */}
        <div className="admin-ui-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a' }}>Dernières commandes</div>
            <Link href="/admin/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}>
              Tout voir <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>Aucune commande</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentOrders.map((o: any) => (
                <EntityCard key={o.id} onClick={() => router.push(`/admin/orders/${o.id}`)} padding="10px 12px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={o.profile?.full_name} email={o.profile?.email} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.order_number != null ? `n°${o.order_number} · ` : ''}{o.profile?.full_name || o.profile?.email || 'Client'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>
                      {parseFloat(o.total_amount).toFixed(2)} €
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                </EntityCard>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="admin-ui-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <AlertTriangle className="w-4 h-4" style={{ color: '#b45309' }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a' }}>Stock faible</div>
          </div>
          {lowStock.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>
              Tout le stock est correct
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowStock.map((p) => (
                <EntityCard
                  key={p.id}
                  onClick={() => router.push(`/admin/products?search=${encodeURIComponent([p.brand, p.model].filter(Boolean).join(' '))}`)}
                  padding="10px 12px"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: '0.82rem', color: '#0f172a' }}>{lowStockLabel(p)}</span>
                    <span style={{
                      flexShrink: 0, fontSize: '0.72rem', fontWeight: 500,
                      background: p.stock <= 0 ? '#fee2e2' : '#fef3c7',
                      color: p.stock <= 0 ? '#b91c1c' : '#b45309',
                      padding: '2px 8px', borderRadius: 6,
                    }}>
                      {p.stock <= 0 ? 'Rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </EntityCard>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top models */}
      <div className="admin-ui-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <TrendingUp className="w-4 h-4" style={{ color: '#15803d' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#0f172a' }}>Top modèles vendus</div>
        </div>
        {topModels.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px 0' }}>
            Aucune vente enregistrée
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topModels.map((m, i) => {
              const max = topModels[0].qty || 1;
              return (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 18, fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.84rem', color: '#0f172a' }}>{m.name}</span>
                  <div style={{ width: 120, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(m.qty / max) * 100}%`, height: '100%', background: '#3b82f6' }} />
                  </div>
                  <span style={{ width: 56, textAlign: 'right', fontSize: '0.82rem', fontWeight: 500, color: '#0f172a' }}>
                    {m.qty} vendu{m.qty > 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
