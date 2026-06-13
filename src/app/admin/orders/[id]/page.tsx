'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Truck, PackageCheck, MapPin, CreditCard,
  ExternalLink, ChevronRight, ChevronDown, XCircle, ImagePlus, Trash2, ShieldCheck,
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

// Statuts qu'un admin peut assigner manuellement depuis le détail commande
// (en cliquant sur le badge de statut).
const MANUAL_STATUSES = [
  'pending', 'paid', 'supplier_ordered', 'shipped', 'delivered', 'cancelled', 'refunded',
];

// Status ordering for the timeline.
const STATUS_RANK: Record<string, number> = {
  pending: 0, paid: 1, supplier_ordered: 2, shipped: 3, delivered: 4, cancelled: -1,
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
  imei_shipped?: string | null;
  // Snapshots figés à l'achat — survivent à la suppression du produit.
  product_name?: string | null;
  product_sku?: string | null;
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
  shipping_photos?: string[] | null;
  shipping_confirmed_at?: string | null;
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
  const [showShipModal, setShowShipModal] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [boxtalConfigured, setBoxtalConfigured] = useState(true);
  const [labelLoading, setLabelLoading] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/admin/orders/${id}`);
    const data = await res.json();
    if (data.error || !data.order) { setNotFound(true); return; }
    setOrder(data.order);
    setItems(data.items || []);
    setBoxtalConfigured(data.boxtalConfigured !== false);
  };

  // Génère (ou régénère) le bordereau Boxtal/Chronopost pour cette commande.
  const generateLabel = async (regenerate = false) => {
    setLabelLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/shipping-label${regenerate ? '?regenerate=true' : ''}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erreur lors de la génération du bordereau.');
        return;
      }
      if (data.alreadyGenerated) {
        showToast('Bordereau déjà généré — ouvrez-le ou régénérez-le.');
      } else {
        const emailNote = data.email?.sent ? ' · email client envoyé' : '';
        const labelNote = data.label_available ? '' : ' (PDF indisponible côté transporteur)';
        showToast(`Bordereau généré — suivi ${data.tracking_number || '—'}${emailNote}${labelNote}`);
        // Ouvre le PDF si stocké.
        if (data.label_stored) window.open(`/api/admin/orders/${id}/shipping-label`, '_blank');
      }
      await load();
    } catch {
      showToast('Erreur réseau lors de la génération du bordereau.');
    } finally {
      setLabelLoading(false);
    }
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
              {/* Statut cliquable → menu de changement manuel */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen(o => !o)}
                  disabled={updating}
                  title="Changer le statut manuellement"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    border: 'none', background: 'transparent', padding: 0,
                    cursor: updating ? 'wait' : 'pointer',
                  }}
                >
                  <StatusBadge status={order.status} />
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: '#94a3b8' }} />
                </button>
                {statusMenuOpen && (
                  <>
                    <div
                      onClick={() => setStatusMenuOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    />
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 50,
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 6, minWidth: 210,
                    }}>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '4px 8px 6px', fontWeight: 500 }}>
                        Changer le statut
                      </div>
                      {MANUAL_STATUSES.map(s => {
                        const isCurrent = s === order.status;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={updating || isCurrent}
                            onClick={() => { setStatusMenuOpen(false); updateStatus(s); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                              width: '100%', textAlign: 'left', border: 'none',
                              background: isCurrent ? '#f1f5f9' : 'transparent',
                              borderRadius: 7, padding: '7px 8px',
                              cursor: isCurrent ? 'default' : 'pointer',
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <StatusBadge status={s} />
                            {isCurrent && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>actuel</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#a8b3c2' }}>
                #{shortOrderHash(order.id)}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>· {createdLabel}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(order.status === 'paid' || order.status === 'supplier_ordered') && (
              <button className="admin-btn-primary" disabled={updating}
                onClick={() => setShowShipModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck className="w-4 h-4" /> Expédier (IMEI + photos)
              </button>
            )}
            {order.status === 'shipped' && (
              <button className="admin-btn-primary" disabled={updating}
                onClick={() => updateStatus('delivered')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PackageCheck className="w-4 h-4" /> Marquer comme livrée
              </button>
            )}
            {/* Bordereau Boxtal / Chronopost express */}
            {!boxtalConfigured ? (
              <button className="admin-btn admin-btn-ghost" disabled
                title="Renseignez BOXTAL_ACCESS_KEY et BOXTAL_SECRET_KEY"
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6, cursor: 'not-allowed' }}>
                <Truck className="w-4 h-4" /> Configurer Boxtal
              </button>
            ) : order.tracking_number ? (
              <>
                <a className="admin-btn admin-btn-ghost"
                  href={`/api/admin/orders/${id}/shipping-label`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText className="w-4 h-4" /> Voir le bordereau
                </a>
                <button className="admin-btn admin-btn-ghost" disabled={labelLoading}
                  onClick={() => generateLabel(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Truck className="w-4 h-4" /> {labelLoading ? 'Régénération…' : 'Régénérer'}
                </button>
              </>
            ) : (
              <button className="admin-btn-primary" disabled={labelLoading}
                onClick={() => generateLabel(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck className="w-4 h-4" /> {labelLoading ? 'Génération…' : 'Générer le bordereau'}
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
                          {[p?.brand, p?.model].filter(Boolean).join(' ') || item.product_name || '—'}
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
              {['paid', 'supplier_ordered', 'shipped', 'delivered'].includes(order.status) ? (
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

      {/* Shipping evidence section (visible once shipped) */}
      {order.shipping_photos && order.shipping_photos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Section title="Preuves d'expédition (dossier anti-fraude)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: '0.78rem', color: '#15803d' }}>
              <ShieldCheck className="w-4 h-4" />
              <span>IMEI verrouillés sur {items.filter(i => i.imei_shipped).length} article(s) · {order.shipping_photos.length} photo(s) horodatées</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
              {order.shipping_photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Preuve ${i + 1}`}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '0.5px solid #e2e8f0' }} />
                </a>
              ))}
            </div>
          </Section>
        </div>
      )}

      {showShipModal && (
        <ShipModal
          items={items}
          existingTracking={order.tracking_number || ''}
          existingTrackingUrl={order.tracking_url || ''}
          onClose={() => setShowShipModal(false)}
          onConfirm={async (payload) => {
            setUpdating(true);
            try {
              const res = await fetch(`/api/admin/orders/${id}/ship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await res.json();
              if (!res.ok) {
                showToast(data.error || 'Erreur expédition');
                return;
              }
              setShowShipModal(false);
              await load();
              showToast('Commande expédiée, preuves enregistrées');
            } finally {
              setUpdating(false);
            }
          }}
        />
      )}

      {toastElement}
    </div>
  );
}

// =====================================================================
// SHIP MODAL — captures IMEI per item + shipping photos + tracking.
// =====================================================================
function ShipModal({
  items, existingTracking, existingTrackingUrl, onClose, onConfirm,
}: {
  items: OrderItem[];
  existingTracking: string;
  existingTrackingUrl: string;
  onClose: () => void;
  onConfirm: (payload: {
    item_imeis: Record<string, string>;
    shipping_photos: string[];
    tracking_number?: string;
    tracking_url?: string;
  }) => Promise<void>;
}) {
  // Default each item's IMEI to the product's catalog IMEI (admin can correct).
  const [imeis, setImeis] = useState<Record<string, string>>(() =>
    items.reduce((acc, item) => {
      acc[item.id] = item.imei_shipped || item.product?.imei || '';
      return acc;
    }, {} as Record<string, string>)
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [trackingNumber, setTrackingNumber] = useState(existingTracking);
  const [trackingUrl, setTrackingUrl] = useState(existingTrackingUrl);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploads = await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('folder', 'shipping');
          const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload échoué');
          return data.url as string;
        })
      );
      setPhotos((prev) => [...prev, ...uploads]);
    } catch (e: any) {
      setError(e.message || 'Upload échoué');
    } finally {
      setUploading(false);
    }
  };

  const canSubmit =
    items.every((it) => /^\d{14,17}$/.test((imeis[it.id] || '').trim())) &&
    photos.length > 0 &&
    !submitting;

  const submit = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        item_imeis: imeis,
        shipping_photos: photos,
        tracking_number: trackingNumber.trim() || undefined,
        tracking_url: trackingUrl.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'white', borderRadius: 16, maxWidth: 640, width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: 22, borderBottom: '0.5px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Confirmer l'expédition</h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
            Saisis l'IMEI exact envoyé et ajoute des photos (téléphone allumé avec IMEI affiché, emballage scellé).
            Ces preuves sont indispensables en cas de chargeback.
          </p>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', marginBottom: 10 }}>
            IMEI verrouillé par article
          </div>
          {items.map((item) => (
            <div key={item.id} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: 4 }}>
                {[item.product?.brand, item.product?.model].filter(Boolean).join(' ') || item.product_name || '—'}
                {item.product?.imei && (
                  <span style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: '0.72rem', color: '#a8b3c2' }}>
                    (catalogue : {item.product.imei})
                  </span>
                )}
              </label>
              <input
                value={imeis[item.id] || ''}
                onChange={(e) => setImeis({ ...imeis, [item.id]: e.target.value })}
                placeholder="14 à 17 chiffres"
                className="admin-form-input"
                style={{ fontFamily: 'monospace', width: '100%' }}
              />
            </div>
          ))}

          <div style={{ marginTop: 18, fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', marginBottom: 10 }}>
            Photos d'expédition (au moins 1) *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 10 }}>
            {photos.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, border: '0.5px solid #e2e8f0' }} />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  style={{
                    position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)',
                    color: 'white', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer',
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, aspectRatio: '1', border: '1px dashed #cbd5e1', borderRadius: 8,
              color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', background: '#f8fafc',
            }}>
              <ImagePlus className="w-5 h-5" />
              <span>{uploading ? 'Upload…' : 'Ajouter'}</span>
              <input
                type="file" accept="image/*" multiple
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: 4 }}>
              Numéro de suivi (optionnel)
            </label>
            <input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="admin-form-input"
              style={{ width: '100%', marginBottom: 10 }}
            />
            <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: 4 }}>
              URL de suivi (optionnel)
            </label>
            <input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="admin-form-input"
              style={{ width: '100%' }}
            />
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontSize: '0.82rem' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: 16, borderTop: '0.5px solid #e2e8f0',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} className="admin-btn admin-btn-ghost">Annuler</button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="admin-btn-primary"
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            <Truck className="w-4 h-4" style={{ display: 'inline', marginRight: 6 }} />
            {submitting ? 'Enregistrement…' : 'Confirmer l\'expédition'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Timeline({
  rank, createdAt, updatedAt, status,
}: { rank: number; createdAt: string; updatedAt?: string | null; status: string }) {
  const steps = [
    { key: 'paid', label: 'Payée', rank: 1 },
    { key: 'supplier_ordered', label: 'Cmd. fournisseur', rank: 2 },
    { key: 'shipped', label: 'Expédiée', rank: 3 },
    { key: 'delivered', label: 'Livrée', rank: 4 },
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
