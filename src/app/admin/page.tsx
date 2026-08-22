'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Truck, Package, Users, AlertTriangle, ArrowRight, TrendingUp,
} from 'lucide-react';
import { StatTile } from '@/components/admin/ui/StatTile';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
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

// Retrouve le libellé pickup-aware ("Prête à retirer"/"Retirée") sans
// dupliquer la logique déjà écrite pour l'admin détail commande.
function pickupAwareLabel(status: string, isPickup: boolean): string | undefined {
  if (!isPickup) return undefined;
  if (status === 'shipped') return 'Prête à retirer';
  if (status === 'delivered') return 'Retirée';
  return undefined;
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
  const bestDay = salesByDay.reduce<{ date: string; total: number } | null>(
    (best, d) => (!best || d.total > best.total ? d : best),
    null
  );
  const maxTopModelQty = topModels[0]?.qty || 1;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ font: '700 24px/1.15 Inter, sans-serif', letterSpacing: '-.02em', color: '#111827' }}>
          Tableau de bord
        </h1>
        <p style={{ font: '400 13px Inter, sans-serif', color: '#6B7280', marginTop: 4 }}>
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="admin-kpi-grid" style={{ marginBottom: 14 }}>
          <StatTile
            label="Chiffre d'affaires"
            value={`${stats.totalRevenue?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
            delta={stats.revenueDelta}
            hint={stats.revenueDelta == null ? `${stats.paidOrders} commandes payées` : 'vs 30 j précédents'}
            tone="blue"
            icon={<DollarSign className="w-4 h-4" />}
          />
          <StatTile
            label="À expédier"
            value={String(stats.paidOrders)}
            hint="commandes payées à traiter"
            icon={<Truck className="w-4 h-4" />}
            variant="accent-fill"
          />
          <StatTile
            label="Produits actifs"
            value={String(stats.totalProducts)}
            hint={`${lowStock.length} en stock faible`}
            tone="amber"
            icon={<Package className="w-4 h-4" />}
          />
          <StatTile
            label="Clients"
            value={String(stats.totalUsers)}
            hint={`${stats.totalOrders} commandes au total`}
            tone="gray"
            icon={<Users className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Graphique + Paniers, côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'stretch', marginBottom: 14 }} className="admin-chart-row">
        <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px 16px', boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Ventes des 30 derniers jours</div>
              <div style={{ font: '700 26px/1.15 Inter, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', color: '#2F6BFF', marginTop: 6 }}>
                {sales30.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </div>
            </div>
            {bestDay && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '400 11.5px Inter, sans-serif', color: '#9CA3AF' }}>Meilleure journée</div>
                <div style={{ font: '600 13px Inter, sans-serif', color: '#111827' }}>
                  {bestDay.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € ·{' '}
                  {new Date(bestDay.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <MiniBarChart data={salesByDay} />
          </div>
        </div>

        {stats && (() => {
          const carts = stats.pendingOrders || 0;
          const paid = stats.paidOrdersTotal || 0;
          const total = paid + carts;
          const conv = total > 0 ? Math.round((paid / total) * 100) : null;
          const paidPct = total > 0 ? (paid / total) * 100 : 0;
          return (
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px 22px', boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Paniers</div>
              <div style={{ font: '400 12px Inter, sans-serif', color: '#9CA3AF', marginTop: 4 }}>
                Checkout lancé, paiement non finalisé
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
                <div style={{ font: '700 40px/1 Inter, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em', color: '#111827' }}>
                  {carts}
                </div>
                <div style={{ font: '500 13px Inter, sans-serif', color: '#6B7280' }}>ouverts</div>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', marginTop: 18, background: '#EFF1F5' }}>
                <div style={{ width: `${paidPct}%`, background: '#12693F' }} />
                <div style={{ width: `${100 - paidPct}%`, background: '#D5D8DE' }} />
              </div>
              {conv != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
                  <div style={{ font: '500 11.5px Inter, sans-serif', color: '#12693F' }}>{conv} % convertis</div>
                  <div style={{ font: '500 11.5px Inter, sans-serif', color: '#9CA3AF' }}>{paid} payés · {carts} ouverts</div>
                </div>
              )}
              <div style={{ marginTop: 'auto', paddingTop: 18 }}>
                <Link
                  href="/admin/carts"
                  style={{
                    display: 'block', font: '600 12.5px Inter, sans-serif', color: '#1B4ACB',
                    background: '#EEF3FF', padding: '11px 14px', borderRadius: 9, textAlign: 'center',
                    textDecoration: 'none',
                  }}
                >
                  Relancer les {carts} panier{carts === 1 ? '' : 's'}
                </Link>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, alignItems: 'start' }} className="admin-bottom-row">
        {/* Dernières commandes */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px' }}>
            <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Dernières commandes</div>
            <Link href="/admin/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 12.5px Inter, sans-serif', color: '#1B4ACB', textDecoration: 'none' }}>
              Tout voir <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '0.85rem', padding: '0 22px 20px' }}>Aucune commande</div>
          ) : (
            recentOrders.map((o: any) => {
              const isPickup = o.delivery_method === 'pickup';
              const refunded = o.status === 'cancelled' && Boolean(o.refunded_at || o.refund_amount);
              return (
                <div
                  key={o.id}
                  onClick={() => router.push(`/admin/orders/${o.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 13, padding: '12px 22px',
                    borderTop: '1px solid #F1F3F7', cursor: 'pointer',
                  }}
                >
                  <Avatar name={o.profile?.full_name} email={o.profile?.email} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ font: '600 13px Inter, sans-serif', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.profile?.full_name || o.profile?.email || 'Client'}
                    </div>
                    <div style={{ font: '400 11.5px Inter, sans-serif', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.order_number != null ? `n°${o.order_number}` : ''}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right', width: 86 }}>
                    <div style={{ font: '700 13.5px Inter, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#111827', textDecoration: refunded ? 'line-through' : 'none' }}>
                      {parseFloat(o.total_amount).toFixed(2)} €
                    </div>
                    <div style={{ font: '400 11px Inter, sans-serif', color: '#9CA3AF' }}>
                      {new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, width: 158, display: 'flex', justifyContent: 'flex-end' }}>
                    <StatusBadge status={o.status} label={pickupAwareLabel(o.status, isPickup)} refunded={refunded} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Stock faible */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 20px 14px' }}>
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#B0781A' }} />
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Stock faible</div>
            </div>
            {lowStock.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '0.85rem', padding: '0 20px 18px' }}>
                Tout le stock est correct
              </div>
            ) : (
              lowStock.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/admin/products?search=${encodeURIComponent([p.brand, p.model].filter(Boolean).join(' '))}`)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    padding: '11px 20px', borderTop: '1px solid #F1F3F7', cursor: 'pointer',
                  }}
                >
                  <span style={{ font: '400 12.5px Inter, sans-serif', color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lowStockLabel(p)}
                  </span>
                  <span style={{
                    flexShrink: 0, font: '600 11.5px Inter, sans-serif',
                    background: p.stock <= 0 ? '#FBE9E7' : '#F6ECD8',
                    color: p.stock <= 0 ? '#B02A1E' : '#B0781A',
                    padding: '3px 9px', borderRadius: 6,
                  }}>
                    {p.stock <= 0 ? 'Rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Top modèles */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px 20px', boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 16px rgba(16,24,40,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: '#12693F' }} />
              <div style={{ font: '600 14px Inter, sans-serif', color: '#111827' }}>Top modèles vendus</div>
            </div>
            {topModels.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Aucune vente enregistrée</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topModels.map((m) => (
                  <div key={m.name}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{ font: '500 12.5px Inter, sans-serif', color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}
                      </span>
                      <span style={{ font: '700 12px Inter, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#111827', flexShrink: 0 }}>
                        {m.qty}
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: '#EFF1F5', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: '#2F6BFF', width: `${(m.qty / maxTopModelQty) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
