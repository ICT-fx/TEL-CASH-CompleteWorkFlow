'use client';

import { useEffect, useState, useCallback } from 'react';
import type { PrixGroup, PrixColorStock } from '@/app/api/admin/prix/route';
import { DISPLAY_GRADE_ORDER, type DisplayGrade } from '@/lib/products';

const NO_STORE: RequestInit = { cache: 'no-store' };
const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 };
const GRADES: DisplayGrade[] = DISPLAY_GRADE_ORDER;

// Clé identifiant un (modèle, stockage, grade) côté client.
const groupKey = (g: { model: string; storage: string | null; grade: DisplayGrade }) =>
  `${g.model}|${g.storage ?? ''}|${g.grade}`;

export default function PrixPage() {
  const [groups, setGroups] = useState<PrixGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/prix', NO_STORE);
    const d = await r.json();
    setGroups(d.groups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Modèles uniques, ordre d'apparition (le GET trie déjà modèle→stockage→grade).
  const models = Array.from(new Set(groups.map((g) => g.model)));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Prix &amp; stock</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Saisie manuelle des prix par (modèle, stockage, grade). Le prix est partagé
          par toutes les couleurs. Le stock se saisit couleur par couleur.
        </p>
      </div>

      {message && <p style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: 12 }}>{message}</p>}

      {loading ? (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Chargement…</p>
      ) : (
        models.map((model) => (
          <ModelBlock
            key={model}
            model={model}
            groups={groups.filter((g) => g.model === model)}
            onSaved={(msg) => setMessage(msg)}
          />
        ))
      )}
    </div>
  );
}

// Un bloc par modèle : table (stockage × grade) pour le prix, + stock dépliable.
function ModelBlock({ model, groups, onSaved }: {
  model: string;
  groups: PrixGroup[];
  onSaved: (msg: string) => void;
}) {
  const brand = groups[0]?.brand ?? '';
  // Stockages distincts présents pour ce modèle (null = ligne « sans stockage »).
  const storages = Array.from(new Set(groups.map((g) => g.storage ?? '')))
    .sort((a, b) => a.localeCompare(b));
  const byKey = new Map(groups.map((g) => [groupKey(g), g] as const));

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
        {brand} {model}
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
              <th style={{ padding: 10 }}>Stockage</th>
              {GRADES.map((g) => <th key={g} style={{ padding: 10 }}>Grade {g}</th>)}
            </tr>
          </thead>
          <tbody>
            {storages.map((s) => (
              <tr key={s || '∅'} style={{ borderTop: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                <td style={{ padding: 10, fontWeight: 500, color: '#0f172a' }}>{s || '—'}</td>
                {GRADES.map((g) => {
                  const grp = byKey.get(`${model}|${s}|${g}`);
                  return (
                    <td key={g} style={{ padding: 10 }}>
                      {grp ? <PriceCell group={grp} onSaved={onSaved} /> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Cellule prix + barré pour un (modèle, stockage, grade) + stock par couleur dépliable.
function PriceCell({ group, onSaved }: { group: PrixGroup; onSaved: (msg: string) => void }) {
  const [price, setPrice] = useState(String(group.price ?? ''));
  const [compareAt, setCompareAt] = useState(group.compareAtPrice != null ? String(group.compareAtPrice) : '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const savePrice = async () => {
    setBusy(true);
    const r = await fetch('/api/admin/prix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'price',
        model: group.model,
        storage: group.storage,
        grade: group.grade,
        price: Number(price),
        compare_at_price: compareAt.trim() === '' ? null : Number(compareAt),
      }),
    });
    const d = await r.json();
    setBusy(false);
    onSaved(d.error ? `Erreur : ${d.error}` : `${d.updated ?? 0} couleur(s) mises à jour (${group.storage ?? '—'} · ${group.grade}).`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
      <input
        type="number" step="0.01" min={0} placeholder="Prix"
        value={price} onChange={(e) => setPrice(e.target.value)}
        style={{ ...inputStyle, width: 110 }}
      />
      <input
        type="number" step="0.01" min={0} placeholder="Barré"
        value={compareAt} onChange={(e) => setCompareAt(e.target.value)}
        style={{ ...inputStyle, width: 110, color: '#94a3b8' }}
      />
      <button onClick={savePrice} disabled={busy}
        style={{ padding: '5px 10px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontWeight: 500, fontSize: '0.78rem' }}>
        {busy ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <button onClick={() => setOpen((o) => !o)}
        style={{ padding: 0, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem', textAlign: 'left' }}>
        {open ? 'Masquer le stock' : `Stock par couleur (${group.colors.length})`}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
          {group.colors.map((c) => (
            <StockRow key={c.productId} color={c} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

// Une ligne stock = une couleur (= 1 productId). Met à jour UNIQUEMENT cette ligne.
function StockRow({ color, onSaved }: { color: PrixColorStock; onSaved: (msg: string) => void }) {
  const [stock, setStock] = useState(String(color.stock ?? 0));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await fetch('/api/admin/prix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'stock', productId: color.productId, stock: Number(stock) }),
    });
    const d = await r.json();
    setBusy(false);
    onSaved(d.error ? `Erreur : ${d.error}` : `Stock « ${color.color ?? '—'} » = ${Number(stock)}.`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ flex: 1, fontSize: '0.75rem', color: '#475569' }}>{color.color ?? '—'}</span>
      <input
        type="number" min={0} step={1}
        value={stock} onChange={(e) => setStock(e.target.value)}
        style={{ ...inputStyle, width: 56, padding: '3px 6px' }}
      />
      <button onClick={save} disabled={busy}
        style={{ background: 'none', border: 'none', color: busy ? '#94a3b8' : '#16a34a', cursor: busy ? 'wait' : 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
        OK
      </button>
    </div>
  );
}
