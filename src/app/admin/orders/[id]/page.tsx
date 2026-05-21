'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Truck, PackageCheck, MapPin, CreditCard,
  ExternalLink, ChevronRight, XCircle,
} from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { Badge } from '@/components/admin/ui/Badge';
import { useToast } from '@/components/admin/ui/Toast';
import { shortOrderHash } from '@/lib/orderNumber';
import { normalizeGradeLetter, gradeLabelFr } from '@/lib/products';
import { colorLabelFr } from '@/lib/colors';

const SHIPPING_LABELS: Record<string, string> = {
  mondial_relay: 'Mondial Relay',
  chronopost_domicile: 'Chronopost domicile',
  chronopost_relay: 'Chronopost point relais',
};

// Status ordering for the timeline.
const STATUS_RANK: Record<string, number> = {
  pending: 0, paid: 1, shipped: 2, delivered: 3, cancelled: -1,
};

interface ShippingAddress {
  firstName?: string; lastName?: string;
  address?: string; complement?: string;
  zipCode?: string; city?: string; country?: string; phone?: string;
}

interface Product {
  brand?: string | null; model?: string | null;
  images?: string[] | null; imei?: string | null;
  storage_capacity?: string | null; color?: string | null; grade?: string | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: string;
  imei?: string | null;
  product?: Product | null;
}

interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: string;
  discount_amount?: string | null;
  shipping_method: string | null;
  shipping_address: ShippingAddress | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  order_number: number | null;
  profile?: { email?: string | null; full_name?: string | null; phone?: string | null } | null;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { showToast, toastElement } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/admin/orders/${id}`);
    const data = await res.json();
    if (data.error || !data.order) { setNotFound(true); return; }
    setOrder(data.order);
    setItems(data.items || []);
  };

  useEffect(() => {
    if (!id) return;
    load().catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [id]);

  // Status change — reuses the existing PUT route. tracking_url is never written.
  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } finally {
      setUpdating(false);
    }
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, i) => s + parseFloat(i.price_at_purchase || '0') * (i.quantity || 1), 0,
    );
    const total = order ? parseFloat(order.total_amount || '0') : 0;
    const discount = order ? parseFloat(order.discount_amount || '0') : 0;
    const shipping = total - subtotal + discount;
    return { subtotal, total, discount, shipping };
  }, [items, order]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div>
        <BackLink />
        <div className="admin-empty">Commande introuvable</div>
      </div>
    );
  }

  const rank = STATUS_RANK[order.status] ?? 0;
  const isCancelled = order.status === 'cancelled';
  const createdLabel = new Date(order.created_at).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div>
      <BackLink />

      {/* Header */}
      <div className="admin-ui-card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 500, color: '#0f172a' }}>
                Commande {order.order_number != null ? `n°${order.order_number}` : ''}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#a8b3c2' }}>
                #{shortOrderHash(order.id)}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>· {createdLabel}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {order.status === 'paid' && (
              <button className="admin-btn-primary" disabled={updating}
                onClick={() => updateStatus('shipped')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck className="w-4 h-4" /> Marquer comme expédiée
              </button>
            )}
            {order.status === 'shipped' && (
              <button className="admin-btn-primary" disabled={updating}
                onClick={() => updateStatus('delivered')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PackageCheck className="w-4 h-4" /> Marquer comme livrée
              </button>
            )}
            <button className="admin-btn admin-btn-ghost"
              onClick={() => showToast('Envoi de facture — bientôt disponible')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText className="w-4 h-4" /> Envoyer la facture
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ marginTop: 22 }}>
          {isCancelled ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fee2e2', color: '#b91c1c', borderRadius: 10,
              padding: '12px 16px', fontSize: '0.88rem', fontWeight: 500,
            }}>
              <XCircle className="w-4 h-4" />
              Commande annulée
            </div>
          ) : (
            <Timeline rank={rank} createdAt={order.created_at} updatedAt={order.updated_at} status={order.status} />
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }} className="admin-order-grid">
        {/* LEFT: items + totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title={`Articles commandés (${items.length})`}>
            {items.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Aucun article</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((item, idx) => {
                  const p = item.product;
                  const grade = normalizeGradeLetter(p?.grade);
                  const imei = item.imei || p?.imei;
                  return (
                    <div key={item.id} style={{
                      display: 'flex', gap: 14, padding: '14px 0',
                      borderTop: idx === 0 ? 'none' : '0.5px solid #f1f5f9',
                    }}>
                      <img
                        src={p?.images?.[0] || 'https://placehold.co/96x96/f8fafc/cbd5e1?text=📱'}
                        alt={p?.model || ''}
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '0.5px solid #e2e8f0', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.9rem' }}>
                          {[p?.brand, p?.model].filter(Boolean).join(' ') || '—'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>
                          {[
                            p?.storage_capacity || null,
                            grade ? `Grade ${grade}` : null,
                            p?.color ? colorLabelFr(p.color) : null,
                          ].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {imei && (
                          <div style={{ fontSize: '0.72rem', color: '#a8b3c2', marginTop: 3, fontFamily: 'monospace' }}>
                            IMEI : {imei}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.9rem' }}>
                          {parseFloat(item.price_at_purchase || '0').toFixed(2)} €
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                          Quantité : {item.quantity}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Récapitulatif">
            <TotalRow label="Sous-total" value={`${totals.subtotal.toFixed(2)} €`} />
            {totals.discount > 0 && (
              <TotalRow label="Remise" value={`− ${totals.discount.toFixed(2)} €`} accent="#15803d" />
            )}
            <TotalRow
              label="Livraison"
              value={totals.shipping <= 0.01 ? 'Offerte' : `${totals.shipping.toFixed(2)} €`}
              accent={totals.shipping <= 0.01 ? '#15803d' : undefined}
            />
            <div style={{ borderTop: '0.5px solid #e2e8f0', marginTop: 6, paddingTop: 10 }}>
              <TotalRow label="Total" value={`${totals.total.toFixed(2)} €`} strong />
            </div>
          </Section>
        </div>

        {/* RIGHT: client + delivery + payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="Client">
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Avatar name={order.profile?.full_name} email={order.profile?.email} size={42} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.88rem' }}>
                  {order.profile?.full_name || 'Client'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                  {order.profile?.email || '—'}
                </div>
              </div>
            </div>
            {order.profile?.phone && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 10 }}>{order.profile.phone}</div>
            )}
            <Link
              href={`/admin/clients/${order.user_id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 12,
                fontSize: '0.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 500,
              }}
            >
              Voir la fiche client <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </Section>

          <Section title="Livraison">
            <div style={{ display: 'flex', gap: 9 }}>
              <MapPin className="w-4 h-4" style={{ color: '#94a3b8', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.83rem', color: '#0f172a', whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                {formatAddress(order.shipping_address)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
              <Truck className="w-4 h-4" style={{ color: '#94a3b8', flexShrink: 0 }} />
              <span style={{ fontSize: '0.83rem', color: '#0f172a' }}>
                {order.shipping_method
                  ? (SHIPPING_LABELS[order.shipping_method] || order.shipping_method.replace(/_/g, ' '))
                  : '—'}
              </span>
            </div>
            {order.tracking_number && (
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                Suivi : <span style={{ fontFamily: 'monospace' }}>{order.tracking_number}</span>
              </div>
            )}
            {/* Defensive: tracking_url may not exist on every row. */}
            {order.tracking_url ? (
              <a
                href={order.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10,
                  fontSize: '0.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 500,
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Voir le suivi
              </a>
            ) : null}
          </Section>

          <Section title="Paiement">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <CreditCard className="w-4 h-4" style={{ color: '#94a3b8', flexShrink: 0 }} />
              <span style={{ fontSize: '0.83rem', color: '#0f172a' }}>Carte bancaire via Stripe</span>
            </div>
            <div style={{ marginTop: 10 }}>
              {['paid', 'shipped', 'delivered'].includes(order.status) ? (
                <Badge variant="success">Paiement confirmé</Badge>
              ) : order.status === 'cancelled' ? (
                <Badge variant="danger">Annulé</Badge>
              ) : (
                <Badge variant="warning">En attente de paiement</Badge>
              )}
            </div>
          </Section>
        </div>
      </div>

      {toastElement}
    </div>
  );
}

function Timeline({
  rank, createdAt, updatedAt, status,
}: { rank: number; createdAt: string; updatedAt?: string | null; status: string }) {
  const steps = [
    { key: 'paid', label: 'Payée', rank: 1 },
    { key: 'shipped', label: 'Expédiée', rank: 2 },
    { key: 'delivered', label: 'Livrée', rank: 3 },
  ];
  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, i) => {
        const reached = rank >= step.rank;
        const isCurrent = status === step.key;
        // We only have two reliable timestamps: order creation and last update.
        const date = step.key === 'paid' ? fmt(createdAt) : isCurrent ? fmt(updatedAt) : null;
        return (
          <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* Connector line to next step */}
            {i < steps.length - 1 && (
              <div style={{
                position: 'absolute', top: 13, left: '50%', width: '100%', height: 2,
                background: rank > step.rank ? '#16a34a' : '#e2e8f0',
              }} />
            )}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: reached ? '#16a34a' : '#f1f5f9',
              color: reached ? '#fff' : '#94a3b8',
              fontSize: '0.78rem', fontWeight: 500,
              border: reached ? 'none' : '0.5px solid #e2e8f0',
            }}>
              {reached ? '✓' : i + 1}
            </div>
            <div style={{
              fontSize: '0.8rem', marginTop: 7,
              fontWeight: isCurrent ? 500 : 400,
              color: reached ? '#0f172a' : '#94a3b8',
            }}>
              {step.label}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#a8b3c2', marginTop: 2, minHeight: 14 }}>
              {date || ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-ui-card" style={{ padding: 18 }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#64748b', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TotalRow({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <span style={{ fontSize: strong ? '0.95rem' : '0.85rem', color: strong ? '#0f172a' : '#64748b', fontWeight: strong ? 500 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: strong ? '1.05rem' : '0.88rem', fontWeight: 500, color: accent || '#0f172a' }}>
        {value}
      </span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/orders"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: '0.85rem', color: '#64748b', marginBottom: 18, textDecoration: 'none',
      }}
    >
      <ArrowLeft className="w-4 h-4" />
      Retour aux commandes
    </Link>
  );
}

function formatAddress(a: ShippingAddress | null): string {
  if (!a) return '—';
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
  const line1 = [a.address, a.complement].filter(Boolean).join(', ');
  const line2 = [a.zipCode, a.city].filter(Boolean).join(' ');
  const line3 = a.country && a.country !== 'FR' ? a.country : '';
  const out = [name, line1, line2, line3, a.phone].filter(Boolean).join('\n');
  return out || '—';
}
