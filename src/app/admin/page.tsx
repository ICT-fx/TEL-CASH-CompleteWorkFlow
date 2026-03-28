'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.role !== 'admin') { router.push('/'); return; }
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d.stats);
        setRecentOrders(d.recentOrders || []);
        setLowStock(d.lowStock || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [profile]);

  const statusLabels: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };

  if (loading) return <div className="page"><div className="container"><p>Chargement...</p></div></div>;

  return (
    <div className="page">
      <div className="container">
        <div className="flex-between mb-2">
          <h1>⚙️ Dashboard Admin</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin/products" className="btn btn-primary btn-sm">Produits</Link>
            <Link href="/admin/orders" className="btn btn-outline btn-sm">Commandes</Link>
          </div>
        </div>

        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="value">{stats.totalRevenue?.toFixed(0)}€</div>
              <div className="label">Chiffre d&apos;affaires</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.totalOrders}</div>
              <div className="label">Commandes totales</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.paidOrders}</div>
              <div className="label">Commandes payées</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.pendingOrders}</div>
              <div className="label">En attente</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.totalProducts}</div>
              <div className="label">Produits actifs</div>
            </div>
            <div className="stat-card">
              <div className="value">{stats.totalUsers}</div>
              <div className="label">Clients</div>
            </div>
          </div>
        )}

        <div className="two-col">
          <div>
            <div className="card">
              <h2>Dernières commandes</h2>
              {recentOrders.length === 0 ? <p className="text-muted">Aucune commande</p> : (
                <table>
                  <thead><tr><th>Client</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead>
                  <tbody>
                    {recentOrders.map((o: any) => (
                      <tr key={o.id}>
                        <td>{o.profile?.full_name || o.profile?.email || '—'}</td>
                        <td>{parseFloat(o.total_amount).toFixed(2)} €</td>
                        <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status]}</span></td>
                        <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div>
            <div className="card">
              <h2>⚠️ Stock faible</h2>
              {lowStock.length === 0 ? <p className="text-muted">Tout est OK</p> : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {lowStock.map((p: any) => (
                    <li key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <strong>{p.brand} {p.model}</strong>
                      <span style={{ color: 'var(--danger)', marginLeft: 8 }}>{p.stock} en stock</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
