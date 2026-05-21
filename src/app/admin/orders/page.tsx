'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Truck, Calendar } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { EntityCard } from '@/components/admin/ui/EntityCard';
import { shortOrderHash } from '@/lib/orderNumber';

interface Order {
  id: string;
  status: string;
  total_amount: string;
  created_at: string;
  shipping_method: string | null;
  order_number: number | null;
  profile?: { email?: string | null; full_name?: string | null } | null;
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'paid', label: 'Payées' },
  { key: 'shipped', label: 'Expédiées' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
];

const SHIPPING_LABELS: Record<string, string> = {
  mondial_relay: 'Mondial Relay',
  chronopost_domicile: 'Chronopost domicile',
  chronopost_relay: 'Chronopost point relais',
};

function shippingLabel(method: string | null): string {
  if (!method) return '—';
  return SHIPPING_LABELS[method] || method.replace(/_/g, ' ');
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchOrders = async (status: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders('all'); }, []);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.profile?.full_name || '').toLowerCase().includes(q) ||
           (o.profile?.email || '').toLowerCase().includes(q) ||
           o.id.toLowerCase().includes(q) ||
           (o.order_number != null && `n°${o.order_number}`.includes(q));
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Commandes</h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
          {filtered.length} commande{filtered.length > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <div className="admin-search-wrap">
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder="Rechercher par client ou n° commande..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-segment">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              className={statusFilter === tab.key ? 'active' : ''}
              onClick={() => { setStatusFilter(tab.key); fetchOrders(tab.key); }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">Aucune commande trouvée</div>
      ) : (
        <div className="admin-card-grid">
          {filtered.map(order => (
            <EntityCard
              key={order.id}
              onClick={() => router.push(`/admin/orders/${order.id}`)}
              padding={20}
            >
              {/* Top row: number + status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '1.05rem', lineHeight: 1.2 }}>
                    {order.order_number != null ? `n°${order.order_number}` : 'Commande'}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#a8b3c2', marginTop: 2 }}>
                    #{shortOrderHash(order.id)}
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {/* Client */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Avatar name={order.profile?.full_name} email={order.profile?.email} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.85rem', fontWeight: 500, color: '#0f172a',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {order.profile?.full_name || 'Client'}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', color: '#94a3b8',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {order.profile?.email || '—'}
                  </div>
                </div>
              </div>

              {/* Footer: amount + meta */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                borderTop: '0.5px solid #e2e8f0', paddingTop: 14,
              }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 500, color: '#0f172a' }}>
                  {parseFloat(order.total_amount).toFixed(2)} €
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                    <Truck className="w-3 h-3" /> {shippingLabel(order.shipping_method)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                    <Calendar className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </EntityCard>
          ))}
        </div>
      )}
    </div>
  );
}
