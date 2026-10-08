'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { LoyaltyBadge, getLoyaltySegment, type LoyaltySegment } from '@/components/admin/ui/LoyaltyBadge';

interface Client {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
}

type SegmentFilter = 'all' | LoyaltySegment;

const SEGMENT_TABS: { key: SegmentFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'vip', label: 'VIP' },
  { key: 'fidele', label: 'Fidèles' },
  { key: 'nouveau', label: 'Nouveaux' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

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
    clearTimeout((window as any).__clientSearchTimer);
    (window as any).__clientSearchTimer = setTimeout(() => fetchClients(val), 300);
  };

  // Segment filtering is done client-side on the loaded set.
  const filtered = useMemo(() => {
    if (segment === 'all') return clients;
    return clients.filter((c) => getLoyaltySegment(c.total_spent) === segment);
  }, [clients, segment]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Clients</h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
          {filtered.length} client{filtered.length > 1 ? 's' : ''}
          {segment !== 'all' && ` · segment ${SEGMENT_TABS.find(t => t.key === segment)?.label.toLowerCase()}`}
        </p>
      </div>

      <div className="admin-filters" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <div className="admin-search-wrap">
          <Search className="w-4 h-4" />
          <input
            className="admin-search"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <div className="admin-segment">
          {SEGMENT_TABS.map(tab => (
            <button
              key={tab.key}
              className={segment === tab.key ? 'active' : ''}
              onClick={() => setSegment(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">Aucun client trouvé</div>
      ) : (
        <div className={`bo-card bo-flush bo-cl ${openId ? 'bo-cl-open' : ''}`}>
          <table className="bo-otable bo-cltable">
            <thead><tr><th>Client</th><th className="r">Commandes</th><th className="r">Dépensé</th><th className="bo-hide-m">Dernier achat</th><th className="bo-hide-m">Fidélité</th></tr></thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className={openId === client.id ? 'is-open' : ''} onClick={() => setOpenId(client.id)}>
                  <td className="bo-o-who">
                    <span><Avatar name={client.full_name} email={client.email} size={28} />
                      <span style={{ minWidth: 0 }}>
                        <button type="button" className="bo-row-btn" aria-expanded={openId === client.id} onClick={(e) => { e.stopPropagation(); setOpenId(client.id); }}>
                          <b>{client.full_name || 'Client'}</b>
                        </button>
                        <small>{client.email}</small>
                      </span></span>
                  </td>
                  <td className="r">{client.order_count}</td>
                  <td className="r"><b>{client.total_spent > 0 ? `${client.total_spent.toFixed(0)} €` : '—'}</b></td>
                  <td className="bo-hide-m">{formatDate(client.last_order_at)}</td>
                  <td className="bo-hide-m"><LoyaltyBadge totalSpent={client.total_spent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {openId && <ClientPanel id={openId} onClose={() => setOpenId(null)} onOpen={() => router.push(`/admin/clients/${openId}`)} />}
        </div>
      )}
    </div>
  );
}

// Panneau latéral (maquette L1) : l'essentiel d'un client sans quitter la liste.
// Données : GET /api/admin/clients/[id] (déjà utilisée par la fiche complète).
const WARRANTY_MONTHS = 24;
function ClientPanel({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: () => void }) {
  const [data, setData] = useState<{ client: any; orders: any[] } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    setData(null);
    let alive = true;
    fetch(`/api/admin/clients/${id}`).then((r) => r.json()).then((d) => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const c = data?.client;
  const paid = (data?.orders || []).filter((o) => ['paid', 'supplier_ordered', 'shipped', 'delivered'].includes(o.status));
  return (
    <aside className="bo-clp" aria-label="Aperçu du client">
      <div className="bo-clp-h">
        <span className="bo-clp-who"><Avatar name={c?.full_name} email={c?.email} size={36} />
          <span><b>{c?.full_name || (data ? 'Client' : 'Chargement…')}</b><small>{c?.email || ''}</small></span></span>
        <button type="button" className="bo-btn" onClick={onClose} aria-label="Fermer l'aperçu">Fermer</button>
      </div>
      {data && (
        <>
          <dl className="bo-clp-kv">
            {c?.phone && (<><dt>Téléphone</dt><dd><a href={`tel:${c.phone}`}>{c.phone}</a></dd></>)}
            <dt>Client depuis</dt><dd>{formatDate(c?.created_at ?? null)}</dd>
            <dt>Achats</dt><dd>{paid.length} · {paid.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0).toFixed(0)} €</dd>
          </dl>
          <p className="bo-clp-k">Ses téléphones</p>
          {paid.length === 0 ? <p className="bo-muted">Aucun achat pour l’instant.</p> : (
            <ul className="bo-clp-list">
              {paid.slice(0, 6).map((o) => {
                const item = o.items?.[0];
                const name = item?.product ? [item.product.brand, item.product.model].filter(Boolean).join(' ') : (item?.product_name || 'Commande');
                const end = new Date(o.created_at); end.setMonth(end.getMonth() + WARRANTY_MONTHS);
                const active = end > new Date();
                return (
                  <li key={o.id}>
                    <a href={`/admin/orders/${o.id}`}>
                      <b>{name}</b>
                      <small>{o.order_number != null ? `n°${o.order_number} · ` : ''}{new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · {parseFloat(o.total_amount).toFixed(0)} €</small>
                    </a>
                    <span className={`bo-tag ${active ? 'bo-tag-ok' : 'bo-tag-mute'}`}>{active ? `garantie jusqu’au ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}` : 'garantie terminée'}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="bo-btn bo-clp-open" onClick={onOpen}>Ouvrir la fiche complète (notes, liste noire)</button>
        </>
      )}
    </aside>
  );
}

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: small ? '0.95rem' : '1.3rem',
        fontWeight: 500, color: '#0f172a', lineHeight: 1.25,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#a8b3c2', marginTop: 4, fontWeight: 400 }}>{label}</div>
    </div>
  );
}
