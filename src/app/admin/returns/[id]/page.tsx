'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
  Truck, AlertTriangle, ImageOff,
} from 'lucide-react';
import { useToast } from '@/components/admin/ui/Toast';

const REASON_LABELS: Record<string, string> = {
  retractation: 'Rétractation (14j)',
  defective: 'Produit défectueux',
  not_as_described: 'Non conforme',
  wrong_item: 'Mauvais article',
  other: 'Autre',
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  requested:   { label: 'À examiner',         color: '#b45309', bg: '#fef3c7' },
  approved:    { label: 'Approuvée',          color: '#1e40af', bg: '#dbeafe' },
  label_sent:  { label: 'Étiquette envoyée',  color: '#1e40af', bg: '#dbeafe' },
  in_transit:  { label: 'En transit',         color: '#5b21b6', bg: '#ede9fe' },
  received:    { label: 'Reçu',               color: '#475569', bg: '#f1f5f9' },
  inspecting:  { label: 'Inspection',         color: '#475569', bg: '#f1f5f9' },
  refunded:    { label: 'Remboursé',          color: '#15803d', bg: '#dcfce7' },
  rejected:    { label: 'Refusé',             color: '#b91c1c', bg: '#fee2e2' },
};

export default function AdminReturnDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { showToast, toastElement } = useToast();
  const [returnReq, setReturnReq] = useState<any | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Inspection form state
  const [imeiMatch, setImeiMatch] = useState<boolean | null>(null);
  const [conditionOk, setConditionOk] = useState<boolean | null>(null);
  const [factoryReset, setFactoryReset] = useState<boolean | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const load = async () => {
    const res = await fetch(`/api/admin/returns/${id}`);
    const data = await res.json();
    setReturnReq(data.return_request);
    setOrder(data.order);
    setItems(data.items || []);
    if (data.return_request) {
      setImeiMatch(data.return_request.inspection_imei_matches);
      setConditionOk(data.return_request.inspection_condition_ok);
      setFactoryReset(data.return_request.inspection_factory_reset);
      setAdminNotes(data.return_request.admin_notes || '');
      setTrackingNumber(data.return_request.return_tracking_number || '');
      if (data.order) setRefundAmount(parseFloat(data.order.total_amount).toFixed(2));
    }
    setLoading(false);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const callAction = async (payload: Record<string, any>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erreur');
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!returnReq) {
    return (
      <div>
        <BackLink />
        <div className="admin-empty">Retour introuvable</div>
      </div>
    );
  }

  const s = STATUS_LABELS[returnReq.status];
  const inspectionDone = imeiMatch !== null && conditionOk !== null && factoryReset !== null;
  const canRefund = inspectionDone && imeiMatch && conditionOk && factoryReset;

  return (
    <div>
      <BackLink />

      <div className="admin-ui-card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 500, color: '#0f172a' }}>
            {returnReq.rma_number}
          </h1>
          <span style={{
            padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 500,
            color: s.color, background: s.bg,
          }}>{s.label}</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 6 }}>
          Motif : {REASON_LABELS[returnReq.reason]} ·
          Créée le {new Date(returnReq.created_at).toLocaleString('fr-FR')}
        </div>
        {returnReq.description && (
          <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'pre-line' }}>
            {returnReq.description}
          </div>
        )}

        {returnReq.photos && returnReq.photos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>Photos du client</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
              {returnReq.photos.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '0.5px solid #e2e8f0' }} alt="" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* LEFT: Order context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {order && (
            <div className="admin-ui-card" style={{ padding: 18 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#64748b', marginBottom: 12 }}>
                Commande liée
              </div>
              <Link href={`/admin/orders/${order.id}`} style={{ color: '#1d4ed8', fontSize: '0.85rem', fontWeight: 500 }}>
                Ouvrir la commande →
              </Link>
              <div style={{ fontSize: '0.85rem', color: '#0f172a', marginTop: 8 }}>
                Total : <strong>{parseFloat(order.total_amount).toFixed(2)} €</strong>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
                Statut : {order.status}
              </div>

              {/* Shipping evidence (IMEI shipped + photos) */}
              {items.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck className="w-3.5 h-3.5" /> IMEI expédiés (référence pour inspection)
                  </div>
                  {items.map((item) => (
                    <div key={item.id} style={{ fontSize: '0.78rem', marginBottom: 4 }}>
                      <span style={{ color: '#475569' }}>{item.product?.brand} {item.product?.model} :</span>{' '}
                      <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 500 }}>
                        {item.imei_shipped || item.product?.imei || '— non enregistré'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {order.shipping_photos && order.shipping_photos.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>Photos d'expédition</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
                    {order.shipping_photos.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: '0.5px solid #e2e8f0' }} alt="" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(!order.shipping_photos || order.shipping_photos.length === 0) && (
                <div style={{ marginTop: 12, padding: 10, background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageOff className="w-3.5 h-3.5" />
                  Aucune photo d'expédition enregistrée — preuve manquante en cas de litige
                </div>
              )}
            </div>
          )}

          {/* Customer info */}
          <div className="admin-ui-card" style={{ padding: 18 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#64748b', marginBottom: 8 }}>Client</div>
            <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 500 }}>
              {returnReq.profile?.full_name || '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{returnReq.profile?.email}</div>
            {returnReq.profile?.phone && (
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{returnReq.profile.phone}</div>
            )}
          </div>
        </div>

        {/* RIGHT: Action flow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1: Approve */}
          {returnReq.status === 'requested' && (
            <ActionCard title="1. Décision initiale">
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>
                Vérifie l'éligibilité (délai, motif, photos client) avant d'approuver et d'envoyer l'étiquette retour.
              </p>
              <button
                disabled={busy}
                onClick={() => callAction({ action: 'approve' })}
                className="admin-btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <CheckCircle2 className="w-4 h-4" /> Approuver la demande
              </button>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Motif de refus</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="admin-form-input"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder="Ex : délai dépassé, motif non recevable…"
                />
                <button
                  disabled={busy || !rejectionReason.trim()}
                  onClick={() => callAction({ action: 'reject', rejection_reason: rejectionReason })}
                  className="admin-btn admin-btn-ghost"
                  style={{ width: '100%', marginTop: 6, color: '#b91c1c', borderColor: '#fecaca' }}
                >
                  <XCircle className="w-4 h-4" style={{ display: 'inline', marginRight: 6 }} />
                  Refuser
                </button>
              </div>
            </ActionCard>
          )}

          {/* Step 2: Send return label */}
          {returnReq.status === 'approved' && (
            <ActionCard title="2. Envoyer l'étiquette retour">
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 8 }}>
                Génère l'étiquette de retour (Mondial Relay / Chronopost) et saisis le numéro de suivi.
              </p>
              <input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Numéro de suivi retour"
                className="admin-form-input"
                style={{ width: '100%', marginBottom: 8, fontFamily: 'monospace' }}
              />
              <button
                disabled={busy || !trackingNumber.trim()}
                onClick={() => callAction({ action: 'label_sent', return_tracking_number: trackingNumber })}
                className="admin-btn-primary"
                style={{ width: '100%' }}
              >
                <Truck className="w-4 h-4" style={{ display: 'inline', marginRight: 6 }} />
                Étiquette envoyée
              </button>
            </ActionCard>
          )}

          {/* Step 3: Mark received */}
          {returnReq.status === 'label_sent' && (
            <ActionCard title="3. Colis reçu">
              <button
                disabled={busy}
                onClick={() => callAction({ action: 'received' })}
                className="admin-btn-primary"
                style={{ width: '100%' }}
              >
                <Package className="w-4 h-4" style={{ display: 'inline', marginRight: 6 }} />
                Marquer le colis comme reçu
              </button>
            </ActionCard>
          )}

          {/* Step 4: Inspect */}
          {(returnReq.status === 'received' || returnReq.status === 'inspecting') && (
            <ActionCard title="4. Inspection du colis">
              <CheckRow label="IMEI identique à celui expédié" value={imeiMatch} setValue={setImeiMatch} />
              <CheckRow label="État conforme (photos vs colis reçu)" value={conditionOk} setValue={setConditionOk} />
              <CheckRow label="Réinitialisation usine effectuée (iCloud / Google déconnecté)" value={factoryReset} setValue={setFactoryReset} />

              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Notes internes (état, défauts constatés…)"
                className="admin-form-input"
                style={{ width: '100%', marginTop: 10, fontSize: '0.82rem' }}
              />

              <button
                disabled={busy || !inspectionDone}
                onClick={() => callAction({
                  action: 'inspect',
                  inspection_imei_matches: imeiMatch,
                  inspection_condition_ok: conditionOk,
                  inspection_factory_reset: factoryReset,
                  admin_notes: adminNotes,
                })}
                className="admin-btn admin-btn-ghost"
                style={{ width: '100%', marginTop: 10 }}
              >
                Enregistrer l'inspection
              </button>

              {inspectionDone && (
                <div style={{ marginTop: 12, padding: 10, background: canRefund ? '#f0fdf4' : '#fef3c7', borderRadius: 8, fontSize: '0.78rem', color: canRefund ? '#15803d' : '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {canRefund ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {canRefund
                    ? 'Inspection conforme — remboursement possible.'
                    : 'Un ou plusieurs critères non conformes — refus recommandé ou remboursement partiel.'}
                </div>
              )}

              {/* Refund action */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Montant à rembourser (€)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="admin-form-input"
                  style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
                />
                <button
                  disabled={busy || !refundAmount || parseFloat(refundAmount) <= 0}
                  onClick={async () => {
                    if (!confirm(`Confirmer le remboursement Stripe de ${refundAmount} € ?`)) return;
                    await callAction({ action: 'refund', refund_amount: parseFloat(refundAmount) });
                  }}
                  className="admin-btn-primary"
                  style={{ width: '100%', background: '#15803d' }}
                >
                  Rembourser via Stripe
                </button>
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.78rem', color: '#64748b' }}>Refuser (motif obligatoire)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="admin-form-input"
                  style={{ width: '100%', marginTop: 4 }}
                />
                <button
                  disabled={busy || !rejectionReason.trim()}
                  onClick={() => callAction({ action: 'reject', rejection_reason: rejectionReason })}
                  className="admin-btn admin-btn-ghost"
                  style={{ width: '100%', marginTop: 6, color: '#b91c1c', borderColor: '#fecaca' }}
                >
                  Refuser le remboursement
                </button>
              </div>
            </ActionCard>
          )}

          {/* Refunded state */}
          {returnReq.status === 'refunded' && (
            <ActionCard title="Remboursement effectué">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: '0.85rem' }}>
                <ShieldCheck className="w-4 h-4" />
                {returnReq.refund_amount ? parseFloat(returnReq.refund_amount).toFixed(2) : '—'} € remboursés
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6, fontFamily: 'monospace' }}>
                Stripe ID : {returnReq.stripe_refund_id}
              </div>
            </ActionCard>
          )}

          {/* Rejected state */}
          {returnReq.status === 'rejected' && (
            <ActionCard title="Demande refusée">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#b91c1c', fontSize: '0.85rem' }}>
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{returnReq.rejection_reason}</span>
              </div>
            </ActionCard>
          )}
        </div>
      </div>

      {toastElement}
    </div>
  );
}

function CheckRow({ label, value, setValue }: { label: string; value: boolean | null; setValue: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f1f5f9' }}>
      <span style={{ fontSize: '0.82rem', color: '#0f172a' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => setValue(true)}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500,
            background: value === true ? '#dcfce7' : 'white',
            color: value === true ? '#15803d' : '#64748b',
            border: '0.5px solid', borderColor: value === true ? '#86efac' : '#e2e8f0',
            cursor: 'pointer',
          }}
        >OK</button>
        <button
          onClick={() => setValue(false)}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500,
            background: value === false ? '#fee2e2' : 'white',
            color: value === false ? '#b91c1c' : '#64748b',
            border: '0.5px solid', borderColor: value === false ? '#fca5a5' : '#e2e8f0',
            cursor: 'pointer',
          }}
        >KO</button>
      </div>
    </div>
  );
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-ui-card" style={{ padding: 18 }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#0f172a', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/returns" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: '0.85rem', color: '#64748b', marginBottom: 18, textDecoration: 'none',
    }}>
      <ArrowLeft className="w-4 h-4" /> Retours
    </Link>
  );
}
