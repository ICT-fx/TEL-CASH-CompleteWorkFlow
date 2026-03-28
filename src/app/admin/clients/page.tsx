'use client';

import { useEffect, useState } from 'react';
import { Search, X, User, ShoppingBag } from 'lucide-react';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientDetail, setClientDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchClients = async (q = '') => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('search', q);
    const res = await fetch(`/api/admin/clients?${params}`);
    const data = await res.json();
    setClients(data.clients || []);
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    // Debounce search
    clearTimeout((window as any).__clientSearchTimer);
    (window as any).__clientSearchTimer = setTimeout(() => fetchClients(val), 300);
  };

  const openDetail = async (client: any) => {
    setSelectedClient(client);
    setLoadingDetail(true);
    const res = await fetch(`/api/admin/clients/${client.id}`);
    const data = await res.json();
    setClientDetail(data);
    setLoadingDetail(false);
  };

  const statusLabels: Record<string, string> = {
    pending: 'En attente', paid: 'Payée', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée'
  };
  const statusColors: Record<string, string> = {
    pending: 'admin-badge-yellow', paid: 'admin-badge-blue', shipped: 'admin-badge-purple',
    delivered: 'admin-badge-green', cancelled: 'admin-badge-red'
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Clients</h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>{clients.length} client{clients.length > 1 ? 's' : ''}</p>
      </div>

      <div className="admin-filters">
        <div className="admin-search-wrap">
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-body">
          {loading ? (
            <div className="admin-empty">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
            </div>
          ) : clients.length === 0 ? (
            <div className="admin-empty">Aucun client trouvé</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Commandes</th>
                  <th>Total dépensé</th>
                  <th>Inscrit le</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.82rem', color: '#4338ca', flexShrink: 0,
                        }}>
                          {(c.full_name?.[0] || c.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.full_name || '—'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{c.phone || '—'}</td>
                    <td>
                      <span className="admin-badge admin-badge-blue">{c.order_count}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {c.total_spent > 0 ? `${c.total_spent.toFixed(2)} €` : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="admin-modal-overlay" onClick={() => setSelectedClient(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: '#fff', fontSize: '0.9rem',
                }}>
                  {(selectedClient.full_name?.[0] || selectedClient.email?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <div className="admin-modal-title">{selectedClient.full_name || 'Client'}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{selectedClient.email}</div>
                </div>
              </div>
              <button className="admin-icon-btn" onClick={() => setSelectedClient(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="admin-modal-body">
              {loadingDetail ? (
                <div className="admin-empty">
                  <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
                </div>
              ) : clientDetail ? (
                <div>
                  {/* Client info */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    <div className="admin-kpi" style={{ flex: 1, minWidth: 140 }}>
                      <div className="admin-kpi-label">Commandes</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.3rem' }}>{clientDetail.orders?.length || 0}</div>
                    </div>
                    <div className="admin-kpi" style={{ flex: 1, minWidth: 140 }}>
                      <div className="admin-kpi-label">Total dépensé</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.3rem' }}>
                        {clientDetail.orders?.reduce(
                          (sum: number, o: any) => ['paid', 'shipped', 'delivered'].includes(o.status) ? sum + parseFloat(o.total_amount) : sum, 0
                        ).toFixed(2)} €
                      </div>
                    </div>
                    <div className="admin-kpi" style={{ flex: 1, minWidth: 140 }}>
                      <div className="admin-kpi-label">Points fidélité</div>
                      <div className="admin-kpi-value" style={{ fontSize: '1.3rem' }}>{clientDetail.totalPoints || 0}</div>
                    </div>
                  </div>

                  {/* Contact info  */}
                  <div style={{ marginBottom: 24, padding: '16px', background: '#f8fafc', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Informations</div>
                    <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div><strong>Email :</strong> {clientDetail.client?.email}</div>
                      <div><strong>Téléphone :</strong> {clientDetail.client?.phone || '—'}</div>
                      <div><strong>Inscrit le :</strong> {new Date(clientDetail.client?.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                  </div>

                  {/* Order history */}
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                      Historique des commandes
                    </div>
                    {(!clientDetail.orders || clientDetail.orders.length === 0) ? (
                      <div className="admin-empty" style={{ padding: 24 }}>Aucune commande</div>
                    ) : (
                      <div>
                        {clientDetail.orders.map((order: any) => (
                          <div key={order.id} style={{
                            padding: '14px 0',
                            borderBottom: '1px solid #f1f5f9',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>
                                  #{order.id.slice(0, 8)}
                                </span>
                                <span style={{ marginLeft: 12 }}>
                                  <span className={`admin-badge ${statusColors[order.status]}`}>
                                    {statusLabels[order.status]}
                                  </span>
                                </span>
                              </div>
                              <div style={{ fontWeight: 600 }}>{parseFloat(order.total_amount).toFixed(2)} €</div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                              {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {order.items && order.items.length > 0 && (
                                <span> · {order.items.map((i: any) => `${i.product?.brand} ${i.product?.model}`).join(', ')}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
