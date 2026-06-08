'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Truck, Calendar, PackageCheck, X } from 'lucide-react';
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
  { key: 'supplier_ordered', label: 'Commande fournisseur' },
  { key: 'shipped', label: 'Expédiées' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'refunded', label: 'Retours' },
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
  const [pendingPaid, setPendingPaid] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const fetchOrders = async (status: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  const fetchPendingPaid = async () => {
    try {
      const res = await fetch('/api/admin/orders/supplier-order');
      if (!res.ok) return;
      const data = await res.json();
      setPendingPaid(data.pending_paid || 0);
    } catch {}
  };

  useEffect(() => { fetchOrders('all'); fetchPendingPaid(); }, []);

  const generateSupplierOrder = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/admin/orders/supplier-order', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération');
      router.push(`/admin/orders/supplier-order/${data.id}`);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Erreur');
      setGenerating(false);
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Commandes</h1>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            {filtered.length} commande{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setGenError(null); setShowConfirm(true); }}
          disabled={pendingPaid === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: pendingPaid === 0 ? '#e2e8f0' : '#0f172a',
            color: pendingPaid === 0 ? '#94a3b8' : 'white',
            border: 'none', borderRadius: 8, padding: '10px 16px',
            fontSize: '0.9rem', fontWeight: 500,
            cursor: pendingPaid === 0 ? 'not-allowed' : 'pointer',
          }}
          title={pendingPaid === 0 ? 'Aucune commande payée à transmettre' : undefined}
        >
          <PackageCheck className="w-4 h-4" />
          Commander chez le fournisseur
          {pendingPaid > 0 && (
            <span style={{
              minWidth: 20, height: 20, padding: '0 6px', background: '#1d4ed8',
              color: 'white', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>
              {pendingPaid}
            </span>
          )}
        </button>
      </div>

      {showConfirm && (
        <div
          onClick={() => !generating && setShowConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: 14, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>Commander chez le fournisseur</h2>
              {!generating && (
                <button onClick={() => setShowConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              <strong>{pendingPaid}</strong> commande{pendingPaid > 1 ? 's' : ''} payée{pendingPaid > 1 ? 's' : ''} {pendingPaid > 1 ? 'seront regroupées' : 'sera regroupée'} dans un bon de commande à relire.
              Les commandes <strong>ne changeront de statut qu&apos;après ton approbation</strong> sur le bon généré.
            </p>
            {genError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.85rem', padding: '10px 12px', borderRadius: 8, marginBottom: 16 }}>
                {genError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={generating}
                style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: '0.88rem', fontWeight: 500, cursor: generating ? 'not-allowed' : 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={generateSupplierOrder}
                disabled={generating}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '0.88rem', fontWeight: 500, cursor: generating ? 'wait' : 'pointer' }}
              >
                {generating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4" /> Générer le bon
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
