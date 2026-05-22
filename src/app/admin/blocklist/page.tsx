'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/admin/ui/Toast';

const TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  ip: 'IP',
  imei: 'IMEI',
  phone: 'Téléphone',
  user_id: 'Utilisateur',
};

export default function BlocklistPage() {
  const { showToast, toastElement } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/blocklist');
    const data = await res.json();
    setEntries(data.entries || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!value.trim() || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value, reason }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error); return; }
      setValue(''); setReason(''); setShowForm(false);
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Retirer cette entrée de la blocklist ?')) return;
    await fetch(`/api/admin/blocklist?id=${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f172a' }}>Blocklist anti-fraude</h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
            Emails, IPs, IMEI et comptes bloqués au checkout. Utilisé pour les récidivistes (chargeback frauduleux, IMEI revendu, etc.).
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="admin-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="admin-ui-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 10 }}>
            <select value={type} onChange={(e) => setType(e.target.value)} className="admin-form-input">
              <option value="email">Email</option>
              <option value="ip">IP</option>
              <option value="imei">IMEI</option>
              <option value="phone">Téléphone</option>
              <option value="user_id">User ID</option>
            </select>
            <input
              value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={`Valeur (${TYPE_LABELS[type]})`}
              className="admin-form-input"
            />
          </div>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (ex: chargeback frauduleux 2026-04, swap fraud RMA-2026-0012…)"
            className="admin-form-input"
            style={{ width: '100%', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} className="admin-btn admin-btn-ghost">Annuler</button>
            <button onClick={add} disabled={busy || !value || !reason} className="admin-btn-primary">
              {busy ? 'Ajout…' : 'Ajouter à la blocklist'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="admin-empty">Aucune entrée dans la blocklist</div>
      ) : (
        <div className="admin-ui-card" style={{ overflow: 'hidden' }}>
          {entries.map((e, idx) => (
            <div key={e.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
              borderTop: idx === 0 ? 'none' : '0.5px solid #f1f5f9',
            }}>
              <ShieldAlert className="w-4 h-4" style={{ color: '#b91c1c' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 500, background: '#fee2e2', color: '#b91c1c' }}>
                    {TYPE_LABELS[e.type]}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#0f172a', fontWeight: 500 }}>
                    {e.value}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 3 }}>
                  {e.reason} · {new Date(e.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <button onClick={() => remove(e.id)} className="admin-btn admin-btn-ghost" style={{ padding: 6 }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {toastElement}
    </div>
  );
}
