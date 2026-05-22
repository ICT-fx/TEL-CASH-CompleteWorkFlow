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
  const [filter, setFilter] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const url = filter ? `/api/admin/returns?status=${filter}` : '/api/admin/returns';
    const res = await fetch(url);
    const data = await res.json();
    setReturns(data.returns || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f172a' }}>Retours & remboursements</h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
            Gérer les demandes de retour, inspecter les colis reçus, déclencher les remboursements Stripe.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: '', label: 'Tous' },
          { v: 'requested', label: 'À examiner' },
          { v: 'approved', label: 'Approuvés' },
          { v: 'label_sent', label: 'Étiquette envoyée' },
          { v: 'received', label: 'Reçus' },
          { v: 'inspecting', label: 'En inspection' },
          { v: 'refunded', label: 'Remboursés' },
          { v: 'rejected', label: 'Refusés' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            style={{
              padding: '6px 12px', borderRadius: 999,
              border: '0.5px solid', borderColor: filter === f.v ? '#0f172a' : '#e2e8f0',
              background: filter === f.v ? '#0f172a' : 'white',
              color: filter === f.v ? 'white' : '#0f172a',
              fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : returns.length === 0 ? (
        <div className="admin-empty">Aucune demande de retour</div>
      ) : (
        <div className="admin-ui-card" style={{ overflow: 'hidden' }}>
          {returns.map((r, idx) => {
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
