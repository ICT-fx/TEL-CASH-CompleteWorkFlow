'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, Calendar } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';

interface CartItemPreview {
  title: string;
  quantity: number;
  storage: string | null;
  color: string | null;
  grade: string | null;
}

interface Cart {
  id: string;
  status: string;
  total_amount: string;
  created_at: string;
  profile?: { email?: string | null; full_name?: string | null } | null;
  items?: CartItemPreview[];
}

function itemSpecs(it: CartItemPreview): string {
  return [it.storage, it.color, it.grade ? `Grade ${it.grade}` : null]
    .filter(Boolean)
    .join(' · ');
}

export default function AdminCartsPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [paidTotal, setPaidTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/orders?status=pending').then(r => r.json()).catch(() => ({})),
      fetch('/api/admin/stats').then(r => r.json()).catch(() => ({})),
    ]).then(([ordersData, statsData]) => {
      setCarts(ordersData.orders || []);
      setPaidTotal(statsData?.stats?.paidOrdersTotal || 0);
      setLoading(false);
    });
  }, []);

  const cartCount = carts.length;
  const conv = paidTotal + cartCount > 0
    ? Math.round((paidTotal / (paidTotal + cartCount)) * 100)
    : null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.02em' }}>
          Paniers
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
          Clients ayant lancé le checkout sans finaliser le paiement. Utile pour mesurer
          le taux de conversion vers l&apos;achat — ces commandes ne sont pas payées.
        </p>
      </div>

      {/* Bandeau de synthèse : paniers vs payés vs conversion */}
      <div className="admin-grid-3" style={{ marginBottom: 22 }}>
        <div className="admin-ui-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Paniers</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: '#b45309', lineHeight: 1.15, marginTop: 6 }}>
            {cartCount}
          </div>
        </div>
        <div className="admin-ui-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Commandes payées</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: '#15803d', lineHeight: 1.15, marginTop: 6 }}>
            {paidTotal}
          </div>
        </div>
        <div className="admin-ui-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Taux de conversion</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 600, color: '#1d4ed8', lineHeight: 1.15, marginTop: 6 }}>
            {conv != null ? `${conv} %` : '—'}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 76, borderRadius: 14,
              background: 'linear-gradient(100deg, #f1f5f9 30%, #e9eef4 50%, #f1f5f9 70%)',
              backgroundSize: '200% 100%', animation: 'cart-shimmer 1.3s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : carts.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '64px 24px', textAlign: 'center',
          background: '#fff', border: '1px dashed #dbe2ea', borderRadius: 16,
        }}>
          <ShoppingCart className="w-8 h-8" style={{ color: '#cbd5e1' }} />
          <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#475569' }}>Aucun panier en cours</div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Les paniers abandonnés au paiement apparaîtront ici.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {carts.map(cart => (
            <div
              key={cart.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                background: '#fff', border: '1px solid #eef1f5', borderRadius: 14,
                padding: '16px 18px',
              }}
            >
              {/* Articles dans le panier */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(cart.items && cart.items.length > 0 ? cart.items : null)?.map((it, idx) => {
                    const specs = itemSpecs(it);
                    return (
                      <div key={idx} style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.3,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {it.quantity > 1 ? `${it.title} ×${it.quantity}` : it.title}
                        </div>
                        {specs && (
                          <div style={{
                            fontSize: '0.78rem', color: '#64748b', marginTop: 2,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {specs}
                          </div>
                        )}
                      </div>
                    );
                  }) || (
                    <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#94a3b8' }}>Panier vide</div>
                  )}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, marginTop: 12,
                  fontSize: '0.78rem', color: '#94a3b8', flexWrap: 'wrap',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <Avatar name={cart.profile?.full_name} email={cart.profile?.email} size={20} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cart.profile?.full_name || cart.profile?.email || 'Client'}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar className="w-3 h-3" />
                    {new Date(cart.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Badge panier */}
              <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600,
                  background: '#fef3c7', color: '#b45309',
                  padding: '3px 10px', borderRadius: 999,
                }}>
                  Panier
                </span>
              </div>

              {/* Montant potentiel */}
              <div style={{
                flexShrink: 0, width: 96, textAlign: 'right', alignSelf: 'center',
                fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em',
              }}>
                {parseFloat(cart.total_amount).toFixed(2)} €
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes cart-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
