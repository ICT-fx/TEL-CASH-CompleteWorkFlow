'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ExternalLink } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { EntityCard } from '@/components/admin/ui/EntityCard';
import { shortOrderHash } from '@/lib/orderNumber';

interface DisputeOrder {
  id: string;
  order_number: number | null;
  total_amount: string;
  status: string;
  profile?: { email?: string | null; full_name?: string | null } | null;
}
interface Dispute {
  id: string;
  stripe_dispute_id: string;
  stripe_charge_id: string;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  created_at: string;
  order: DisputeOrder | null;
}

// Libellés FR des raisons Stripe (fallback = valeur brute).
const REASON_LABELS: Record<string, string> = {
  fraudulent: 'Frauduleux',
  product_not_received: 'Produit non reçu',
  product_unacceptable: 'Produit non conforme',
  duplicate: 'Doublon',
  credit_not_processed: 'Avoir non traité',
  subscription_canceled: 'Abonnement annulé',
  unrecognized: 'Non reconnu',
  general: 'Général',
  customer_initiated: 'Initié par le client',
};
// Libellés + couleurs des statuts de litige Stripe.
const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  warning_needs_response: { label: 'Alerte — à répondre', bg: '#fef3c7', fg: '#b45309' },
  warning_under_review: { label: 'Alerte — en examen', bg: '#fef3c7', fg: '#b45309' },
  warning_closed: { label: 'Alerte close', bg: '#e2e8f0', fg: '#475569' },
  needs_response: { label: 'À répondre', bg: '#fee2e2', fg: '#b91c1c' },
  under_review: { label: 'En examen', bg: '#dbeafe', fg: '#1d4ed8' },
  won: { label: 'Gagné', bg: '#dcfce7', fg: '#15803d' },
  lost: { label: 'Perdu', bg: '#fee2e2', fg: '#b91c1c' },
  charge_refunded: { label: 'Remboursé', bg: '#e2e8f0', fg: '#475569' },
};

function reasonLabel(r: string): string {
  return REASON_LABELS[r] || r.replace(/_/g, ' ');
}
function statusMeta(s: string) {
  return STATUS_META[s] || { label: s.replace(/_/g, ' '), bg: '#e2e8f0', fg: '#475569' };
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch('/api/admin/disputes');
      const data = await res.json();
      setDisputes(data.disputes || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Litiges</h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
          {disputes.length} litige{disputes.length > 1 ? 's' : ''} — les preuves se soumettent dans le dashboard Stripe
        </p>
      </div>

      {loading ? (
        <div className="admin-empty">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : disputes.length === 0 ? (
        <div className="admin-empty">Aucun litige</div>
      ) : (
        <div className="admin-card-grid">
          {disputes.map(d => {
            const sm = statusMeta(d.status);
            const clickable = !!d.order;
            return (
              <EntityCard
                key={d.id}
                onClick={clickable ? () => router.push(`/admin/orders/${d.order!.id}`) : undefined}
                padding={20}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '1.05rem', lineHeight: 1.2 }}>
                      {reasonLabel(d.reason)}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#a8b3c2', marginTop: 2 }}>
                      {d.stripe_dispute_id}
                    </div>
                  </div>
                  <span style={{
                    background: sm.bg, color: sm.fg, fontSize: '0.72rem', fontWeight: 600,
                    padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
                  }}>{sm.label}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Avatar name={d.order?.profile?.full_name} email={d.order?.profile?.email} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.order?.profile?.full_name || (d.order ? 'Client' : 'Commande inconnue')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.order?.profile?.email || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '0.5px solid #e2e8f0', paddingTop: 14 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 500, color: '#0f172a' }}>
                    {parseFloat(d.amount).toFixed(2)} {d.currency?.toUpperCase() || 'EUR'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    {d.order && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                        <ExternalLink className="w-3 h-3" />
                        {d.order.order_number != null ? `n°${d.order.order_number}` : `#${shortOrderHash(d.order.id)}`}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                      <Calendar className="w-3 h-3" />
                      {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </EntityCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
