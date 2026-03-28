'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch(`/api/orders/${params.id}`)
      .then(r => r.json())
      .then(d => { setOrder(d.order); setItems(d.items || []); setLoading(false); });
  }, [user, params.id]);

  const statusLabels: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };

  if (loading) return <div className="page"><div className="container"><p>Chargement...</p></div></div>;
  if (!order) return <div className="page"><div className="container"><p>Commande introuvable.</p></div></div>;

  return (
    <div className="page">
      <div className="container">
        <Link href="/account/orders">← Mes commandes</Link>
        <h1 style={{ marginTop: 12 }}>Commande #{order.id.slice(0, 8)}</h1>

        <div className="two-col">
          <div>
            <div className="card">
              <h2>Articles</h2>
              {items.map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <strong>{item.product?.brand} {item.product?.model}</strong>
                    <span className="text-muted"> × {item.quantity}</span>
                  </div>
                  <span>{parseFloat(item.price_at_purchase).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card">
              <h2>Informations</h2>
              <p><strong>Statut :</strong> <span className={`badge badge-${order.status}`}>{statusLabels[order.status]}</span></p>
              <p><strong>Date :</strong> {new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
              <p><strong>Total :</strong> {parseFloat(order.total_amount).toFixed(2)} €</p>
              <p><strong>Livraison :</strong> {order.shipping_method?.replace(/_/g, ' ')}</p>
              {order.tracking_number && <p><strong>Suivi :</strong> {order.tracking_number}</p>}
              {order.discount_amount > 0 && <p><strong>Réduction :</strong> -{parseFloat(order.discount_amount).toFixed(2)} €</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
