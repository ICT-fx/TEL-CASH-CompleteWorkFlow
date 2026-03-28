'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const { profile } = useAuth();
  const router = useRouter();

  const fetchOrders = async (status = '') => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  useEffect(() => {
    if (profile && profile.role !== 'admin') { router.push('/'); return; }
    fetchOrders();
  }, [profile]);

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchOrders(statusFilter);
  };

  const statusLabels: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };

  return (
    <div className="page">
      <div className="container">
        <Link href="/admin">← Dashboard</Link>
        <h1 style={{ marginTop: 8 }}>Gestion des commandes</h1>

        <div className="filters">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); fetchOrders(e.target.value); }}>
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="paid">Payées</option>
            <option value="shipped">Expédiées</option>
            <option value="delivered">Livrées</option>
            <option value="cancelled">Annulées</option>
          </select>
        </div>

        {loading ? <p>Chargement...</p> : orders.length === 0 ? (
          <p className="text-muted">Aucune commande trouvée.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Total</th>
                <th>Livraison</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.id.slice(0, 8)}</td>
                  <td>{o.profile?.full_name || o.profile?.email || '—'}</td>
                  <td>{parseFloat(o.total_amount).toFixed(2)} €</td>
                  <td>{o.shipping_method?.replace(/_/g, ' ') || '—'}</td>
                  <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status]}</span></td>
                  <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={e => updateStatus(o.id, e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                    >
                      <option value="pending">En attente</option>
                      <option value="paid">Payée</option>
                      <option value="shipped">Expédiée</option>
                      <option value="delivered">Livrée</option>
                      <option value="cancelled">Annulée</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
