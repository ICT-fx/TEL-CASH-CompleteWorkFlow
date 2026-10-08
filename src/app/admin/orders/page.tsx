'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Truck, PackageCheck, X, Store, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { OrderKanban } from '@/components/admin/orders/OrderKanban';
import { shortOrderHash } from '@/lib/orderNumber';
import { pickupAwareLabel } from '@/lib/orderStatus';
import { colorLabelFr } from '@/lib/colors';

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
  delivery_method: string | null;
  order_number: number | null;
  pickup_code_verified_at?: string | null;
  profile?: { email?: string | null; full_name?: string | null } | null;
  items?: OrderItemPreview[];
  margin?: { amount: number | null; pct: number | null; estimated: boolean; partial: boolean };
}

function itemSpecs(it: OrderItemPreview): string {
  return [it.storage, it.color ? colorLabelFr(it.color) : null, it.grade ? `Grade ${it.grade}` : null]
    .filter(Boolean)
    .join(' · ');
}

// Onglets = les étapes d'une commande, dans l'ordre où Édouard les traite.
// « Expédiée » est coupée en deux : colis parti, ou prêt en boutique.
const STATUS_TABS: { key: string; label: string; status: string; delivery?: 'pickup' | 'home'; countKey: string; hot?: boolean }[] = [
  { key: 'paid', label: 'À commander', status: 'paid', countKey: 'paid', hot: true },
  { key: 'supplier_ordered', label: 'Chez le fournisseur', status: 'supplier_ordered', countKey: 'supplier_ordered' },
  { key: 'pickup', label: 'Retraits en boutique', status: 'shipped', delivery: 'pickup', countKey: 'shipped_pickup', hot: true },
  { key: 'shipped', label: 'Expédiées', status: 'shipped', delivery: 'home', countKey: 'shipped_home' },
  { key: 'delivered', label: 'Livrées', status: 'delivered', countKey: 'delivered' },
  { key: 'all', label: 'Toutes', status: 'all', countKey: 'all' },
  { key: 'refunded', label: 'Remboursées', status: 'refunded', countKey: 'refunded' },
  { key: 'cancelled', label: 'Annulées', status: 'cancelled', countKey: 'cancelled' },
];

const eur0 = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

function MarginCell({ m }: { m?: Order['margin'] }) {
  if (!m || m.amount == null) {
    return <span className="bo-mg bo-mg-none" title="Prix d'achat inconnu pour cette commande">—</span>;
  }
  const tone = m.pct == null ? '' : m.pct < 15 ? 'bo-mg-bad' : m.pct < 20 ? 'bo-mg-warn' : 'bo-mg-ok';
  const why = [
    m.estimated ? 'estimée avec le prix fournisseur actuel (prix d’achat non enregistré au moment de la vente)' : 'calculée avec le prix d’achat enregistré à la vente',
    m.partial ? 'un article sans prix d’achat n’est pas compté' : null,
  ].filter(Boolean).join(' · ');
  return (
    <span className={`bo-mg ${tone}`} title={why}>
      <b>{m.estimated ? '≈ ' : ''}{eur0(m.amount)}</b>
      {m.pct != null && <small>{`${m.pct.toLocaleString('fr-FR')} %`}</small>}
    </span>
  );
}

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
  const [statusFilter, setStatusFilter] = useState('paid');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'home' | 'pickup'>('all');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [pendingPaid, setPendingPaid] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const fetchOrders = async (tabKey: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    const tab = STATUS_TABS.find((t) => t.key === tabKey);
    params.set('status', tab ? tab.status : tabKey); // 'active' = vue tableau
    if (tab?.delivery) params.set('delivery', tab.delivery);
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

  // Lien direct depuis l'écran Aujourd'hui : /admin/orders?status=paid
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('status');
    const initial = wanted && STATUS_TABS.some((t) => t.key === wanted) ? wanted : 'paid';
    setStatusFilter(initial);
    fetchOrders(initial);
    fetchPendingPaid();
  }, []);

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
    if (deliveryFilter !== 'all' && (o.delivery_method || 'home') !== deliveryFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.profile?.full_name || '').toLowerCase().includes(q) ||
           (o.profile?.email || '').toLowerCase().includes(q) ||
           o.id.toLowerCase().includes(q) ||
           (o.order_number != null && `n°${o.order_number}`.includes(q));
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.02em' }}>Commandes</h1>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
            {filtered.length} commande{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', border: '1px solid #eef1f5', borderRadius: 10, padding: 3 }}>
            <button
              onClick={() => setView('list')}
              title="Vue liste"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7,
                border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
                background: view === 'list' ? '#fff' : 'transparent',
                color: view === 'list' ? '#0f172a' : '#64748b',
                boxShadow: view === 'list' ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
              }}
            >
              <ListIcon className="w-4 h-4" /> Liste
            </button>
            <button
              onClick={() => { setView('kanban'); fetchOrders('active'); }}
              title="Vue tableau — glisser-déposer pour changer le statut"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7,
                border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
                background: view === 'kanban' ? '#fff' : 'transparent',
                color: view === 'kanban' ? '#0f172a' : '#64748b',
                boxShadow: view === 'kanban' ? '0 1px 3px rgba(15,23,42,0.12)' : 'none',
              }}
            >
              <LayoutGrid className="w-4 h-4" /> Tableau
            </button>
          </div>
          <a
            className="btn-ghost"
            href="/api/admin/orders/export"
            title="Export CSV des commandes payées, expédiées et livrées — pour Excel"
          >
            Exporter les factures
          </a>
          <button className="btn-ghost" onClick={createTestOrder} disabled={creatingTest}>
            {creatingTest ? 'Création…' : '+ Commande de test'}
          </button>
          <button
            className="btn-dark"
            onClick={() => { setGenError(null); setShowConfirm(true); }}
            disabled={pendingPaid === 0}
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

      {/* Onglets de catégorie — contrôle segmenté groupé, centré. Masqués en
          vue tableau : les colonnes du kanban jouent déjà ce rôle. */}
      {view === 'list' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div className="tabs-wrap">
            {STATUS_TABS.map(tab => {
              const active = statusFilter === tab.key;
              const count = counts[tab.countKey] ?? 0;
              return (
                <button
                  key={tab.key}
                  className={`tab${active ? ' active' : ''}${tab.hot && count > 0 ? ' hot' : ''}`}
                  onClick={() => { setStatusFilter(tab.key); fetchOrders(tab.key); }}
                >
                  <span className="tab-label">{tab.label}</span>
                  <span className="tab-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 22, gap: 10, flexWrap: 'wrap' }}>
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
        <select
          className="admin-select"
          value={deliveryFilter}
          onChange={e => setDeliveryFilter(e.target.value as 'all' | 'home' | 'pickup')}
        >
          <option value="all">Tous modes de livraison</option>
          <option value="home">Domicile</option>
          <option value="pickup">Retrait magasin</option>
        </select>
      </div>

      {view === 'kanban' ? (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="order-skeleton" />
            ))}
          </div>
        ) : (
          <OrderKanban orders={filtered} onChanged={() => fetchOrders('active')} />
        )
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="order-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '64px 24px', textAlign: 'center',
          background: '#fff', border: '1px dashed #dbe2ea', borderRadius: 16,
        }}>
          <PackageCheck className="w-8 h-8" style={{ color: '#cbd5e1' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#475569' }}>Aucune commande trouvée</div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Essaie un autre filtre ou modifie ta recherche.</div>
        </div>
      ) : (
        <div className="bo-card bo-flush">
          <table className="bo-otable">
            <thead>
              <tr>
                <th>N°</th><th>Client</th><th>Téléphone</th><th className="bo-hide-m">Livraison</th>
                <th className="r">Montant</th><th className="r">Marge</th><th>Étape</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const it = order.items?.[0];
                const isPickup = order.delivery_method === 'pickup';
                const who = order.profile?.full_name || order.profile?.email || 'Client';
                return (
                  <tr key={order.id} onClick={() => router.push(`/admin/orders/${order.id}`)}>
                    <td className="bo-o-n">
                      <a href={`/admin/orders/${order.id}`} onClick={(e) => e.stopPropagation()}>
                        {order.order_number != null ? `n°${order.order_number}` : `#${shortOrderHash(order.id)}`}
                      </a>
                      <small>{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</small>
                    </td>
                    <td className="bo-o-who">
                      <span><Avatar name={order.profile?.full_name} email={order.profile?.email} size={26} /><b>{who}</b></span>
                    </td>
                    <td className="bo-o-dev">
                      {it ? (
                        <>
                          <b>{it.quantity > 1 ? `${it.title} ×${it.quantity}` : it.title}</b>
                          <small>{[itemSpecs(it), (order.items?.length || 0) > 1 ? `+ ${(order.items?.length || 0) - 1} article(s)` : null].filter(Boolean).join(' · ')}</small>
                        </>
                      ) : <small>Aucun article</small>}
                    </td>
                    <td className="bo-hide-m bo-o-ship">
                      {isPickup ? (<><Store className="w-3.5 h-3.5" aria-hidden /> Retrait boutique</>) : (<><Truck className="w-3.5 h-3.5" aria-hidden /> {shippingLabel(order.shipping_method)}</>)}
                    </td>
                    <td className="r bo-o-amt">{parseFloat(order.total_amount).toFixed(2).replace('.', ',')} €</td>
                    <td className="r bo-o-mg"><MarginCell m={order.margin} /></td>
                    <td className="bo-o-st"><StatusBadge status={order.status} label={pickupAwareLabel(order.status, isPickup)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="bo-o-note">
            Marge = prix de vente − prix d’achat. « ≈ » : prix d’achat pas enregistré au moment de la vente, estimé avec le prix fournisseur actuel.
          </p>
        </div>
      )}

      <style jsx>{`
        /* Boutons d'action de l'en-tête */
        .btn-ghost, .btn-dark {
          display: inline-flex; align-items: center; gap: 8px;
          border-radius: 10px; padding: 10px 16px;
          font-size: 0.88rem; font-weight: 500;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
        }
        .btn-ghost {
          background: #fff; color: #0f172a; border: 1px solid #e2e8f0; cursor: pointer;
        }
        .btn-ghost:hover:not(:disabled) {
          border-color: #cbd5e1; background: #f8fafc; transform: translateY(-1px);
        }
        .btn-ghost:disabled { cursor: wait; opacity: .7; }
        .btn-dark {
          background: #0f172a; color: #fff; border: none; cursor: pointer;
          box-shadow: 0 4px 12px rgba(15,23,42,0.16);
        }
        .btn-dark:hover:not(:disabled) {
          transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15,23,42,0.24);
        }
        .btn-dark:disabled {
          background: #e2e8f0; color: #94a3b8; box-shadow: none; cursor: not-allowed;
        }

        /* Contrôle segmenté des onglets */
        .tabs-wrap {
          display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 6px;
          padding: 6px; background: #f1f5f9; border: 1px solid #eef1f5; border-radius: 16px;
        }
        .tab {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 16px; border-radius: 11px; border: 1px solid transparent;
          background: transparent; color: #475569; cursor: pointer;
          transition: all .16s ease;
        }
        .tab:hover { background: #fff; color: #0f172a; }
        .tab.active {
          background: #0f172a; border-color: #0f172a; color: #fff;
          box-shadow: 0 4px 12px rgba(15,23,42,0.22);
        }
        .tab-label { font-size: 0.9rem; font-weight: 500; }
        .tab.active .tab-label { font-weight: 600; }
        .tab-count {
          min-width: 22px; padding: 1px 7px; border-radius: 999px;
          font-size: 0.74rem; font-weight: 700; line-height: 1.5; text-align: center;
          background: #e2e8f0; color: #64748b; transition: all .16s ease;
        }
        .tab:hover .tab-count { background: #e2e8f0; }
        .tab.active .tab-count { background: rgba(255,255,255,0.2); color: #fff; }
        .tab.hot:not(.active) .tab-count { background: #2563EB; color: #fff; }

        /* Lignes de commande */
        .order-row {
          display: flex; align-items: flex-start; gap: 16px;
          background: #fff; border: 1px solid #eef1f5; border-radius: 14px;
          padding: 16px 18px; cursor: pointer;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }
        .order-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 26px rgba(15,23,42,0.09);
          border-color: #dbe2ea;
        }
        .order-chevron { transition: transform .16s ease, color .16s ease; }
        .order-row:hover .order-chevron { transform: translateX(4px); color: #64748b; }

        /* Squelette de chargement */
        .order-skeleton {
          height: 84px; border-radius: 14px;
          background: linear-gradient(100deg, #f1f5f9 30%, #e9eef4 50%, #f1f5f9 70%);
          background-size: 200% 100%;
          animation: order-shimmer 1.3s ease-in-out infinite;
        }
        @keyframes order-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @media (min-width: 768px) {
          .order-row-meta { display: flex !important; }
        }
        @media (max-width: 768px) {
          .tabs-wrap { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; max-width: 100%; min-width: 0; scrollbar-width: none; }
          .tabs-wrap::-webkit-scrollbar { display: none; }
          .tab { flex: none; padding: 8px 12px; }
        }
      `}</style>
    </div>
  );
}
