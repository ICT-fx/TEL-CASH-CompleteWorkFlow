'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch('/api/orders')
      .then(r => r.json())
      .then(d => { setOrders(d.orders || []); setLoading(false); });
  }, [user]);

  const statusLabels: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };

  return (
    <div className="page">
      <div className="container">
        <Link href="/account">← Mon compte</Link>
        <h1 style={{ marginTop: 12 }}>Historique des commandes</h1>

        {loading ? <p>Chargement...</p> : orders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p>Aucune commande pour le moment.</p>
            <Link href="/products" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Parcourir le catalogue</Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>N° Commande</th>
                <th>Date</th>
                <th>Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.id.slice(0, 8)}</td>
                  <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{parseFloat(o.total_amount).toFixed(2)} €</td>
                  <td><span className={`badge badge-${o.status}`}>{statusLabels[o.status] || o.status}</span></td>
                  <td><Link href={`/account/orders/${o.id}`} className="btn btn-outline btn-sm">Détails</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
