'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Truck, Calendar, PackageCheck, X, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { shortOrderHash } from '@/lib/orderNumber';

interface OrderItemPreview {
  title: string;
  quantity: number;
  storage: string | null;
  color: string | null;
  grade: string | null;
}

interface Order {
  id: string;
  status: string;
  total_amount: string;
  created_at: string;
  shipping_method: string | null;
  order_number: number | null;
  profile?: { email?: string | null; full_name?: string | null } | null;
  items?: OrderItemPreview[];
}

function itemSpecs(it: OrderItemPreview): string {
  return [it.storage, it.color, it.grade ? `Grade ${it.grade}` : null]
    .filter(Boolean)
    .join(' · ');
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
  const [counts, setCounts] = useState<Record<string, number>>({});
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
    if (data.counts) setCounts(data.counts);
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

  const [creatingTest, setCreatingTest] = useState(false);
  const createTestOrder = async () => {
    setCreatingTest(true);
    try {
      const res = await fetch('/api/admin/orders/test-order', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      router.push(`/admin/orders/${data.orderId}`);
    } catch {
      setCreatingTest(false);
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={createTestOrder}
          disabled={creatingTest}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1',
            borderRadius: 10, padding: '10px 16px', fontSize: '0.88rem', fontWeight: 500,
            cursor: creatingTest ? 'wait' : 'pointer',
          }}>
          {creatingTest ? 'Création…' : '+ Commande de test'}
        </button>
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

      {/* Onglets de catégorie — gros, centrés et bien en évidence */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {STATUS_TABS.map(tab => {
            const active = statusFilter === tab.key;
            const count = counts[tab.key] ?? 0;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); fetchOrders(tab.key); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: active ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  background: active ? '#0f172a' : 'white',
                  color: active ? 'white' : '#475569',
                  boxShadow: active ? '0 4px 12px rgba(15,23,42,0.18)' : 'none',
                  transition: 'all .15s ease',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: active ? 600 : 500 }}>{tab.label}</span>
                <span style={{
                  minWidth: 22, padding: '1px 7px', borderRadius: 999,
                  fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.4,
                  background: active ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
                  color: active ? 'white' : '#64748b',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 18 }}>
        <div className="admin-search-wrap" style={{ width: '100%', maxWidth: 520 }}>
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            style={{ width: '100%' }}
            placeholder="Rechercher par client ou n° commande..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">Aucune commande trouvée</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(order => (
            <div
              key={order.id}
              onClick={() => router.push(`/admin/orders/${order.id}`)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                background: 'white', border: '0.5px solid #e2e8f0', borderRadius: 12,
                padding: '14px 18px', cursor: 'pointer',
                transition: 'box-shadow .15s ease, border-color .15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.08)';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {/* N° commande */}
              <div style={{ flexShrink: 0, width: 88 }}>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.98rem', lineHeight: 1.2 }}>
                  {order.order_number != null ? `n°${order.order_number}` : 'Commande'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#a8b3c2', marginTop: 2 }}>
                  #{shortOrderHash(order.id)}
                </div>
              </div>

              {/* Produits commandés — un par ligne, avec specs */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(order.items && order.items.length > 0 ? order.items : null)?.map((it, idx) => {
                    const specs = itemSpecs(it);
                    return (
                      <div key={idx} style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.95rem', fontWeight: 500, color: '#0f172a',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {it.quantity > 1 ? `${it.title} ×${it.quantity}` : it.title}
                        </div>
                        {specs && (
                          <div style={{
                            fontSize: '0.78rem', color: '#64748b', marginTop: 1,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {specs}
                          </div>
                        )}
                      </div>
                    );
                  }) || (
                    <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#94a3b8' }}>Aucun article</div>
                  )}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                  fontSize: '0.76rem', color: '#94a3b8',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  <Avatar name={order.profile?.full_name} email={order.profile?.email} size={18} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {order.profile?.full_name || order.profile?.email || 'Client'}
                  </span>
                </div>
              </div>

              {/* Méta : livraison + date */}
              <div style={{
                flexShrink: 0, display: 'none', flexDirection: 'column', gap: 3, alignItems: 'flex-end',
              }} className="order-row-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                  <Truck className="w-3 h-3" /> {shippingLabel(order.shipping_method)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                  <Calendar className="w-3 h-3" />
                  {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Statut */}
              <div style={{ flexShrink: 0 }}>
                <StatusBadge status={order.status} />
              </div>

              {/* Montant */}
              <div style={{ flexShrink: 0, width: 90, textAlign: 'right', fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
                {parseFloat(order.total_amount).toFixed(2)} €
              </div>

              <ChevronRight className="w-4 h-4" style={{ flexShrink: 0, color: '#cbd5e1' }} />
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @media (min-width: 768px) {
          .order-row-meta { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
