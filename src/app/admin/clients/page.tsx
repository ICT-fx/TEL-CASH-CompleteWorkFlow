'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { LoyaltyBadge, getLoyaltySegment, type LoyaltySegment } from '@/components/admin/ui/LoyaltyBadge';
import { EntityCard } from '@/components/admin/ui/EntityCard';

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
        <div className="admin-card-grid">
          {filtered.map(client => (
            <EntityCard
              key={client.id}
              onClick={() => router.push(`/admin/clients/${client.id}`)}
              padding={22}
            >
              {/* Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
                <Avatar name={client.full_name} email={client.email} size={46} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontWeight: 500, color: '#0f172a', fontSize: '0.92rem',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {client.full_name || 'Client'}
                  </div>
                  <div style={{
                    fontSize: '0.78rem', color: '#94a3b8',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {client.email}
                  </div>
                </div>
                <LoyaltyBadge totalSpent={client.total_spent} />
              </div>

              {/* Stats */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                borderTop: '0.5px solid #e2e8f0', paddingTop: 16,
              }}>
                <Stat value={String(client.order_count)} label="Commandes" />
                <Stat
                  value={client.total_spent > 0 ? `${client.total_spent.toFixed(0)} €` : '—'}
                  label="Dépensé"
                />
                <Stat value={formatDate(client.last_order_at)} label="Dern. commande" small />
              </div>
            </EntityCard>
          ))}
        </div>
      )}
    </div>
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
