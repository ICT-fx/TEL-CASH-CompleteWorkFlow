'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d.stats);
        setRecentOrders(d.recentOrders || []);
        setLowStock(d.lowStock || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const statusLabels: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };
  const statusColors: Record<string, string> = {
    pending: 'admin-badge-yellow', paid: 'admin-badge-blue', shipped: 'admin-badge-purple',
    delivered: 'admin-badge-green', cancelled: 'admin-badge-red'
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="admin-kpi-grid">
          <div className="admin-kpi">
            <div className="admin-kpi-icon" style={{ background: '#dbeafe' }}>
              <DollarSign className="w-5 h-5" style={{ color: '#2563eb' }} />
            </div>
            <div className="admin-kpi-label">Chiffre d&apos;affaires</div>
            <div className="admin-kpi-value">{stats.totalRevenue?.toLocaleString('fr-FR', { minimumFractionDigits: 0 })} €</div>
            <div className="admin-kpi-sub">{stats.paidOrders} commandes payées</div>
          </div>
          <div className="admin-kpi">
            <div className="admin-kpi-icon" style={{ background: '#fef3c7' }}>
              <ShoppingCart className="w-5 h-5" style={{ color: '#d97706' }} />
            </div>
            <div className="admin-kpi-label">À expédier</div>
            <div className="admin-kpi-value">{stats.paidOrders}</div>
            <div className="admin-kpi-sub">{stats.pendingOrders} en attente de paiement</div>
          </div>
          <div className="admin-kpi">
            <div className="admin-kpi-icon" style={{ background: '#dcfce7' }}>
              <Package className="w-5 h-5" style={{ color: '#16a34a' }} />
            </div>
            <div className="admin-kpi-label">Produits actifs</div>
            <div className="admin-kpi-value">{stats.totalProducts}</div>
            <div className="admin-kpi-sub">{lowStock.length} en stock faible</div>
          </div>
          <div className="admin-kpi">
            <div className="admin-kpi-icon" style={{ background: '#f3e8ff' }}>
              <Users className="w-5 h-5" style={{ color: '#7c3aed' }} />
            </div>
            <div className="admin-kpi-label">Clients</div>
            <div className="admin-kpi-value">{stats.totalUsers}</div>
            <div className="admin-kpi-sub">{stats.totalOrders} commandes totales</div>
          </div>
        </div>
      )}

      <div className="admin-grid-2">
        {/* Recent orders */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Dernières commandes</div>
            <Link href="/admin/orders" className="admin-btn admin-btn-ghost admin-btn-sm">
              Tout voir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="admin-panel-body">
            {recentOrders.length === 0 ? (
              <div className="admin-empty">Aucune commande</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Total</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o: any) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 500 }}>{o.profile?.full_name || o.profile?.email || '—'}</td>
                      <td>{parseFloat(o.total_amount).toFixed(2)} €</td>
                      <td>
                        <span className={`admin-badge ${statusColors[o.status]}`}>
                          {statusLabels[o.status]}
                        </span>
                      </td>
                      <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        {new Date(o.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle className="w-4 h-4" style={{ color: '#d97706' }} />
              Stock faible
            </div>
          </div>
          <div className="admin-panel-body">
            {lowStock.length === 0 ? (
              <div className="admin-empty">
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</div>
                Tout le stock est OK
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {lowStock.map((p: any) => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 20px', borderBottom: '1px solid #f1f5f9'
                  }}>
                    <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{p.brand} {p.model}</span>
                    <span className="admin-badge admin-badge-red">{p.stock} restant{p.stock > 1 ? 's' : ''}</span>
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
