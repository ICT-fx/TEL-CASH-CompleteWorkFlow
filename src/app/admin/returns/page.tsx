'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, ChevronRight, Clock } from 'lucide-react';

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

type TabKey = 'todo' | 'waiting' | 'done';
const TABS: { key: TabKey; label: string; statuses: string[]; hint: string }[] = [
  { key: 'todo', label: 'À traiter', statuses: ['requested', 'received', 'inspecting'], hint: 'demande à examiner, ou colis reçu à contrôler' },
  { key: 'waiting', label: 'En attente du client', statuses: ['approved', 'label_sent', 'in_transit'], hint: 'étiquette envoyée, colis pas encore reçu' },
  { key: 'done', label: 'Terminés', statuses: ['refunded', 'rejected'], hint: 'remboursés ou refusés' },
];

const REASON_LABELS: Record<string, string> = {
  retractation: 'Rétractation',
  defective: 'Défectueux',
  not_as_described: 'Non conforme',
  wrong_item: 'Mauvais article',
  other: 'Autre',
};

export default function AdminReturnsListPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Trois onglets (maquette S1) : ce qu'Édouard doit faire, ce qui attend le
  // client ou le transporteur, ce qui est fini. Filtré côté écran, un seul chargement.
  const [tab, setTab] = useState<TabKey>('todo');

  useEffect(() => {
    fetch('/api/admin/returns')
      .then((r) => r.json())
      .then((d) => { setReturns(d.returns || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const inTab = (t: TabKey) => returns.filter((r) => TABS.find((x) => x.key === t)!.statuses.includes(r.status));
  const shown = inTab(tab);

  return (
    <div>
      <header className="bo-head">
        <h1>Retours et SAV</h1>
        <p>Demandes de retour et pannes sous garantie · {TABS.find((t) => t.key === tab)?.hint}</p>
      </header>

      <div className="bo-seg" role="group" aria-label="Retours" style={{ marginBottom: 14 }}>
        {TABS.map((t) => {
          const n = inTab(t.key).length;
          return (
            <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label} <span className={`bo-seg-n ${t.key === 'todo' && n > 0 ? 'hot' : ''}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="admin-empty">{tab === 'todo' ? 'Rien à traiter pour l’instant' : 'Aucune demande ici'}</div>
      ) : (
        <div className="admin-ui-card" style={{ overflow: 'hidden' }}>
          {shown.map((r, idx) => {
            const s = STATUS_LABELS[r.status] || { label: r.status, color: '#475569', bg: '#f1f5f9' };
            return (
              <Link key={r.id} href={`/admin/returns/${r.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 18px',
                  borderTop: idx === 0 ? 'none' : '0.5px solid #f1f5f9',
                  textDecoration: 'none',
                }}
              >
                <RotateCcw className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>
                      {r.rma_number}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 500,
                      color: s.color, background: s.bg,
                    }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      · {REASON_LABELS[r.reason] || r.reason}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: '0.75rem', color: '#94a3b8' }}>
                    <Clock className="w-3 h-3" />
                    {new Date(r.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {r.profile?.email && <span>· {r.profile.email}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: '#cbd5e1' }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
