'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Mail, Phone, MapPin } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { LoyaltyBadge } from '@/components/admin/ui/LoyaltyBadge';
import { StatTile } from '@/components/admin/ui/StatTile';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { EntityCard } from '@/components/admin/ui/EntityCard';
import { useToast } from '@/components/admin/ui/Toast';
import { shortOrderHash } from '@/lib/orderNumber';

const PAID_STATUSES = ['paid', 'shipped', 'delivered'];

interface OrderItem {
  id: string;
  quantity: number;
  product?: { brand?: string | null; model?: string | null } | null;
}

interface Order {
  id: string;
  status: string;
  total_amount: string;
  created_at: string;
  order_number: number | null;
  shipping_address: ShippingAddress | null;
  items?: OrderItem[];
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  address?: string;
  complement?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
}

interface ClientProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
}

interface ClientNote {
  id: string;
  content: string;
  created_at: string;
  author?: { full_name?: string | null; email?: string | null } | null;
}

export default function AdminClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { showToast, toastElement } = useToast();

  const [client, setClient] = useState<ClientProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/clients/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error || !d.client) { setNotFound(true); return; }
        setClient(d.client);
        setOrders(d.orders || []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const loadNotes = () => {
    if (!id) return;
    fetch(`/api/admin/clients/${id}/notes`)
      .then(r => r.json())
      .then(d => setNotes(d.notes || []))
      .catch(() => {});
  };

  useEffect(loadNotes, [id]);

  const addNote = async () => {
    const content = noteDraft.trim();
    if (!content) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      setNoteDraft('');
      loadNotes();
    } catch {
      showToast("La note n'a pas pu être enregistrée");
    } finally {
      setSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    try {
      const res = await fetch(`/api/admin/clients/${id}/notes/${noteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      showToast('Suppression impossible');
      loadNotes();
    }
  };

  // Aggregates
  const { totalSpent, paidCount, avgBasket } = useMemo(() => {
    const paid = orders.filter(o => PAID_STATUSES.includes(o.status));
    const total = paid.reduce((s, o) => s + parseFloat(o.total_amount), 0);
    return {
      totalSpent: total,
      paidCount: paid.length,
      avgBasket: paid.length > 0 ? total / paid.length : null,
    };
  }, [orders]);

  // Latest known shipping address (orders come sorted newest-first).
  const address = useMemo(
    () => orders.find(o => o.shipping_address)?.shipping_address || null,
    [orders],
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div>
        <BackLink />
        <div className="admin-empty">Client introuvable</div>
      </div>
    );
  }

  const memberSince = new Date(client.created_at).toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric',
  });

  return (
    <div>
      <BackLink />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        marginBottom: 24,
      }}>
        <Avatar name={client.full_name} email={client.email} size={64} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 500, color: '#0f172a' }}>
              {client.full_name || 'Client'}
            </h1>
            <LoyaltyBadge totalSpent={totalSpent} />
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 2 }}>
            Client depuis {memberSince}
          </p>
        </div>
        <button
          className="admin-btn-primary"
          onClick={() => showToast('Envoi de facture — bientôt disponible')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FileText className="w-4 h-4" />
          Envoyer la facture
        </button>
      </div>

      {/* Stat tiles */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24,
      }}>
        <StatTile
          label="Total dépensé"
          value={`${totalSpent.toFixed(2)} €`}
          accent="#1d4ed8"
        />
        <StatTile
          label="Commandes"
          value={String(orders.length)}
          hint={paidCount !== orders.length ? `${paidCount} payée${paidCount > 1 ? 's' : ''}` : undefined}
        />
        <StatTile
          label="Panier moyen"
          value={avgBasket != null ? `${avgBasket.toFixed(2)} €` : '—'}
        />
      </div>

      <div className="admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Coordonnées */}
        <div className="admin-ui-card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#64748b', marginBottom: 12 }}>
            Coordonnées
          </div>
          <ContactRow icon={<Mail className="w-4 h-4" />} value={client.email} />
          <ContactRow icon={<Phone className="w-4 h-4" />} value={client.phone || '—'} />
          <ContactRow
            icon={<MapPin className="w-4 h-4" />}
            value={address ? formatAddress(address) : '—'}
            multiline
          />
        </div>

        {/* Notes internes — fil partagé entre admins (visible/éditable par
            tous les comptes admin, pas seulement celui qui a écrit). */}
        <div className="admin-ui-card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#64748b', marginBottom: 12 }}>
            Notes internes
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addNote(); }
              }}
              placeholder="Ajouter une note interne sur ce client… (Ctrl+Entrée pour valider)"
              rows={2}
              style={{
                flex: 1, resize: 'vertical', borderRadius: 8,
                border: '0.5px solid #e2e8f0', padding: '10px 12px',
                fontSize: '0.85rem', color: '#0f172a', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={addNote}
              disabled={savingNote || !noteDraft.trim()}
              className="admin-btn-primary"
              style={{ alignSelf: 'flex-end', opacity: savingNote || !noteDraft.trim() ? 0.5 : 1 }}
            >
              {savingNote ? '…' : 'Ajouter'}
            </button>
          </div>

          {notes.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Aucune note pour ce client.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
              {notes.map((n) => (
                <div key={n.id} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#334155' }}>
                      {n.author?.full_name || n.author?.email || 'Admin'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => deleteNote(n.id)}
                        title="Supprimer"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: '0.72rem', padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {n.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historique des commandes */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#64748b', marginBottom: 10 }}>
          Historique des commandes
        </div>
        {orders.length === 0 ? (
          <div className="admin-empty">Aucune commande</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(order => (
              <EntityCard
                key={order.id}
                onClick={() => router.push(`/admin/orders/${order.id}`)}
                padding="12px 16px"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 70 }}>
                    <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.9rem' }}>
                      {order.order_number != null ? `n°${order.order_number}` : '—'}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#94a3b8' }}>
                      #{shortOrderHash(order.id)}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 140, fontSize: '0.82rem', color: '#475569' }}>
                    {(order.items && order.items.length > 0)
                      ? order.items.map(i => `${i.product?.brand || ''} ${i.product?.model || ''}`.trim()).filter(Boolean).join(', ')
                      : '—'}
                  </div>
                  <StatusBadge status={order.status} />
                  <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.9rem', minWidth: 80, textAlign: 'right' }}>
                    {parseFloat(order.total_amount).toFixed(2)} €
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', minWidth: 90, textAlign: 'right' }}>
                    {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </EntityCard>
            ))}
          </div>
        )}
      </div>

      {toastElement}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/clients"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: '0.85rem', color: '#64748b', marginBottom: 18, textDecoration: 'none',
      }}
    >
      <ArrowLeft className="w-4 h-4" />
      Retour aux clients
    </Link>
  );
}

function ContactRow({ icon, value, multiline }: { icon: React.ReactNode; value: string; multiline?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 10,
      padding: '7px 0', fontSize: '0.85rem', color: '#0f172a',
    }}>
      <span style={{ color: '#94a3b8', display: 'flex', flexShrink: 0, marginTop: multiline ? 2 : 0 }}>{icon}</span>
      <span style={{ whiteSpace: multiline ? 'pre-line' : 'normal' }}>{value}</span>
    </div>
  );
}

function formatAddress(a: ShippingAddress): string {
  const line1 = [a.address, a.complement].filter(Boolean).join(', ');
  const line2 = [a.zipCode, a.city].filter(Boolean).join(' ');
  const line3 = a.country && a.country !== 'FR' ? a.country : '';
  return [line1, line2, line3].filter(Boolean).join('\n') || '—';
}
