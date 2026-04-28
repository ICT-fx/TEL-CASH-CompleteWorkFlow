'use client';

import { useEffect, useState } from 'react';
import { Search, X, Package, MapPin, CreditCard, ExternalLink } from 'lucide-react';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState('');

  const fetchOrders = async (status = 'active') => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders('active'); }, []);

  const openDetail = async (order: any) => {
    setSelectedOrder(order);
    setLoadingDetail(true);
    const res = await fetch(`/api/admin/orders/${order.id}`);
    const data = await res.json();
    setOrderDetail(data);
    setLoadingDetail(false);
  };

  const updateStatus = async (id: string, newStatus: string, url?: string) => {
    const body: any = { status: newStatus };
    if (newStatus === 'shipped' && url) body.tracking_url = url;
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchOrders(statusFilter);
    if (orderDetail && selectedOrder?.id === id) {
      setOrderDetail({ ...orderDetail, order: { ...orderDetail.order, status: newStatus, tracking_url: url || orderDetail.order.tracking_url } });
    }
  };

  const handleShippedSubmit = async () => {
    await updateStatus(selectedOrder.id, 'shipped', trackingUrl);
    setTrackingUrl('');
  };

  const statusLabels: Record<string, string> = {
    pending: 'Panier (Non payé)', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };
  const statusColors: Record<string, string> = {
    pending: 'admin-badge-yellow', paid: 'admin-badge-blue', shipped: 'admin-badge-purple',
    delivered: 'admin-badge-green', cancelled: 'admin-badge-red'
  };

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.profile?.full_name || '').toLowerCase().includes(q) ||
           (o.profile?.email || '').toLowerCase().includes(q) ||
           o.id.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Commandes</h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>{orders.length} commande{orders.length > 1 ? 's' : ''}</p>
      </div>

      <div className="admin-filters">
        <div className="admin-search-wrap">
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder="Rechercher par client ou n° commande..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); fetchOrders(e.target.value); }}
        >
          <option value="active">Actives (Payées / Expédiées)</option>
          <option value="all">Toutes (inclut paniers abandonnés)</option>
          <option value="pending">Paniers / En attente</option>
          <option value="paid">Payées</option>
          <option value="shipped">Expédiées</option>
          <option value="delivered">Livrées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-body">
          {loading ? (
            <div className="admin-empty">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">Aucune commande trouvée</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>Total</th>
                  <th>Livraison</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o: any) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o)}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>
                      #{o.id.slice(0, 8)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.profile?.full_name || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{o.profile?.email}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{parseFloat(o.total_amount).toFixed(2)} €</td>
                    <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {o.shipping_method?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td>
                      <span className={`admin-badge ${statusColors[o.status]}`}>
                        {statusLabels[o.status]}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      {new Date(o.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <select
                        className="admin-status-select"
                        value={o.status}
                        onChange={e => updateStatus(o.id, e.target.value)}
                      >
                        <option value="pending">Panier</option>
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="admin-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                Commande #{selectedOrder.id.slice(0, 8)}
              </div>
              <button className="admin-icon-btn" onClick={() => setSelectedOrder(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="admin-modal-body">
              {loadingDetail ? (
                <div className="admin-empty">
                  <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
                </div>
              ) : orderDetail ? (
                <div>
                  {/* Client info */}
                  <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Client</div>
                      <div style={{ fontWeight: 600 }}>{orderDetail.order?.profile?.full_name || '—'}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{orderDetail.order?.profile?.email}</div>
                      {orderDetail.order?.profile?.phone && (
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{orderDetail.order.profile.phone}</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Détails</div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <div>Total : <strong>{parseFloat(orderDetail.order?.total_amount).toFixed(2)} €</strong></div>
                        <div>Livraison : {orderDetail.order?.shipping_method?.replace(/_/g, ' ') || '—'}</div>
                        <div>Date : {new Date(orderDetail.order?.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        {orderDetail.order?.tracking_number && (
                          <div>Suivi : <code>{orderDetail.order.tracking_number}</code></div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status change */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Statut</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <select
                        className="admin-form-select"
                        style={{ maxWidth: 200 }}
                        value={orderDetail.order?.status}
                        onChange={e => {
                          if (e.target.value === 'shipped') {
                            setOrderDetail({ ...orderDetail, order: { ...orderDetail.order, status: 'shipped' } });
                          } else {
                            updateStatus(selectedOrder.id, e.target.value);
                          }
                        }}
                      >
                        <option value="pending">Panier / Non payé</option>
                        <option value="paid">Payée</option>
                        <option value="shipped">Expédiée</option>
                        <option value="delivered">Livrée</option>
                        <option value="cancelled">Annulée</option>
                      </select>

                      {orderDetail.order?.status === 'shipped' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="url"
                            className="admin-search"
                            placeholder="Lien de suivi (ex: https://...)"
                            value={trackingUrl || orderDetail.order?.tracking_url || ''}
                            onChange={e => setTrackingUrl(e.target.value)}
                            style={{ width: 280 }}
                          />
                          <button
                            className="admin-btn-primary"
                            onClick={handleShippedSubmit}
                          >
                            Valider expédition
                          </button>
                          {orderDetail.order?.tracking_url && (
                            <a href={orderDetail.order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <ExternalLink className="w-3 h-3" /> Voir suivi
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Articles */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Articles</div>
                    {(orderDetail.items || []).map((item: any) => (
                      <div key={item.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 0', borderBottom: '1px solid #f1f5f9'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {item.product?.images?.[0] && (
                            <img src={item.product.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 500 }}>{item.product?.brand} {item.product?.model}</div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>× {item.quantity}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 600 }}>{parseFloat(item.price_at_purchase).toFixed(2)} €</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
