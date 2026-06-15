'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Rounding, MarginType, ScopeLevel } from '@/lib/margins';

interface StatsResp { totalMarginEuro: number; salesCount: number; avgMarginPct: number; }
interface PreviewRow {
  productId: string; brand: string; model: string; grade: string | null;
  storage: string | null; color: string | null; cost: number;
  oldPrice: number; newPrice: number; marginPct: number;
  ruleApplied: string | null; coherenceAdjusted: boolean; lowMargin: boolean;
}
interface Rule {
  id: string; scope_level: ScopeLevel; brand: string | null; model: string | null;
  product_id: string | null; grade: 'A' | 'B' | 'C' | null;
  margin_type: MarginType; margin_percent: number | null; margin_fixed: number | null;
  rounding: Rounding;
}

const ROUNDINGS: { v: Rounding; label: string }[] = [
  { v: 'cent', label: 'Au centime' },
  { v: 'decicent', label: 'Au 1/10 de centime' },
  { v: 'euro', label: "À l'euro" },
  { v: 'five_euro', label: 'À 5 €' },
  { v: 'ten_euro', label: 'À 10 €' },
  { v: 'ends_99', label: 'Finit par ,99' },
];

const eur = (n: number) => `${n.toFixed(2)} €`;
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

export default function MarginsPage() {
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [settings, setSettings] = useState({ coherence_enabled: false, coherence_min_gap_percent: 5 });
  const [rules, setRules] = useState<Rule[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [brand, setBrand] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/admin/margins/stats');
    const d = await r.json();
    setStats(d.stats);
  }, []);
  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/admin/margins/settings');
    const d = await r.json();
    setSettings(d.settings);
  }, []);
  const loadRules = useCallback(async () => {
    const r = await fetch('/api/admin/margins/rules');
    const d = await r.json();
    setRules(d.rules);
  }, []);
  const loadPreview = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (brand) qs.set('brand', brand);
    if (grade) qs.set('grade', grade);
    const r = await fetch(`/api/admin/margins/preview?${qs}`);
    const d = await r.json();
    setRows(d.rows ?? []);
    setLoading(false);
  }, [brand, grade]);

  useEffect(() => { loadStats(); loadSettings(); loadRules(); }, [loadStats, loadSettings, loadRules]);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  const saveSettings = async (next: typeof settings) => {
    setSettings(next);
    await fetch('/api/admin/margins/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
    });
    loadPreview();
  };

  const apply = async () => {
    setApplying(true);
    const r = await fetch('/api/admin/margins/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: brand || undefined }),
    });
    const d = await r.json();
    setApplying(false);
    setMessage(`${d.updated} prix mis à jour.`);
    loadPreview();
  };

  const brands = Array.from(new Set(rows.map((r) => r.brand))).sort();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Marges</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Réglage des marges et des prix de vente à partir du prix fournisseur.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Marge totale réalisée" value={stats ? eur(stats.totalMarginEuro) : '—'} />
        <StatCard label="Ventes comptabilisées" value={stats ? String(stats.salesCount) : '—'} />
        <StatCard label="Marge moyenne" value={stats ? pct(stats.avgMarginPct) : '—'} />
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500, color: '#0f172a' }}>
          <input
            type="checkbox"
            checked={settings.coherence_enabled}
            onChange={(e) => saveSettings({ ...settings, coherence_enabled: e.target.checked })}
          />
          Maintenir la logique de prix A &gt; B &gt; C
        </label>
        <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
          Écart minimum entre grades :
          <input
            type="number" min={0} step={1}
            value={settings.coherence_min_gap_percent}
            onChange={(e) => setSettings({ ...settings, coherence_min_gap_percent: Number(e.target.value) })}
            onBlur={() => saveSettings(settings)}
            style={{ width: 70, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }}
          /> %
        </div>
      </div>

      <RulesEditor rules={rules} onChange={() => { loadRules(); loadPreview(); }} />

      <div className="admin-filters" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '24px 0 16px' }}>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}>
          <option value="">Tous grades</option>
          <option value="A">Grade A</option>
          <option value="B">Grade B</option>
          <option value="C">Grade C</option>
        </select>
        <button
          onClick={apply} disabled={applying}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
        >
          {applying ? 'Application…' : 'Appliquer les prix'}
        </button>
      </div>
      {message && <p style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: 12 }}>{message}</p>}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
              <th style={{ padding: 10 }}>Produit</th>
              <th style={{ padding: 10 }}>Grade</th>
              <th style={{ padding: 10 }}>Coût</th>
              <th style={{ padding: 10 }}>Ancien</th>
              <th style={{ padding: 10 }}>Nouveau</th>
              <th style={{ padding: 10 }}>Marge</th>
              <th style={{ padding: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
            ) : rows.map((r) => (
              <tr key={r.productId} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: 10 }}>{r.brand} {r.model}{r.storage ? ` · ${r.storage}` : ''}{r.color ? ` · ${r.color}` : ''}</td>
                <td style={{ padding: 10 }}>{r.grade ?? '—'}</td>
                <td style={{ padding: 10 }}>{eur(r.cost)}</td>
                <td style={{ padding: 10, color: '#94a3b8' }}>{eur(r.oldPrice)}</td>
                <td style={{ padding: 10, fontWeight: 600, color: r.newPrice !== r.oldPrice ? '#0f172a' : '#64748b' }}>{eur(r.newPrice)}</td>
                <td style={{ padding: 10, color: r.lowMargin ? '#dc2626' : '#16a34a' }}>{pct(r.marginPct)}</td>
                <td style={{ padding: 10 }}>
                  {r.coherenceAdjusted && <span title="Prix remonté pour cohérence A>B>C" style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 4 }}>A&gt;B&gt;C</span>}
                  {r.lowMargin && <span title="Marge faible" style={{ marginLeft: 4, fontSize: '0.7rem', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4 }}>marge faible</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

function RulesEditor({ rules, onChange }: { rules: Rule[]; onChange: () => void }) {
  const [form, setForm] = useState({
    scope_level: 'global' as ScopeLevel, brand: '', model: '', product_id: '',
    grade: '' as '' | 'A' | 'B' | 'C', margin_type: 'percent' as MarginType,
    margin_percent: 20, margin_fixed: 0, rounding: 'ends_99' as Rounding,
  });

  const addRule = async () => {
    await fetch('/api/admin/margins/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope_level: form.scope_level,
        brand: form.brand || null, model: form.model || null,
        product_id: form.product_id || null, grade: form.grade || null,
        margin_type: form.margin_type, margin_percent: form.margin_percent,
        margin_fixed: form.margin_fixed, rounding: form.rounding,
      }),
    });
    onChange();
  };
  const delRule = async (id: string) => {
    await fetch(`/api/admin/margins/rules/${id}`, { method: 'DELETE' });
    onChange();
  };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Règles de marge</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={form.scope_level} onChange={(e) => setForm({ ...form, scope_level: e.target.value as ScopeLevel })}>
          <option value="global">Global</option>
          <option value="brand">Marque</option>
          <option value="model">Modèle</option>
          <option value="product">Produit</option>
        </select>
        {(form.scope_level === 'brand' || form.scope_level === 'model') &&
          <input placeholder="Marque" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />}
        {form.scope_level === 'model' &&
          <input placeholder="Modèle" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />}
        {form.scope_level === 'product' &&
          <input placeholder="ID produit" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} />}
        <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as '' | 'A' | 'B' | 'C' })}>
          <option value="">Tous grades</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
        <select value={form.margin_type} onChange={(e) => setForm({ ...form, margin_type: e.target.value as MarginType })}>
          <option value="percent">%</option><option value="fixed">€</option><option value="combined">% + €</option>
        </select>
        {form.margin_type !== 'fixed' &&
          <input type="number" placeholder="%" value={form.margin_percent} onChange={(e) => setForm({ ...form, margin_percent: Number(e.target.value) })} style={{ width: 70 }} />}
        {form.margin_type !== 'percent' &&
          <input type="number" placeholder="€" value={form.margin_fixed} onChange={(e) => setForm({ ...form, margin_fixed: Number(e.target.value) })} style={{ width: 70 }} />}
        <select value={form.rounding} onChange={(e) => setForm({ ...form, rounding: e.target.value as Rounding })}>
          {ROUNDINGS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
        <button onClick={addRule} style={{ padding: '6px 12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ajouter</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: 8 }}>{r.scope_level}{r.brand ? ` · ${r.brand}` : ''}{r.model ? ` ${r.model}` : ''}{r.grade ? ` · grade ${r.grade}` : ''}</td>
              <td style={{ padding: 8 }}>
                {r.margin_type === 'fixed' ? `+${r.margin_fixed} €`
                  : r.margin_type === 'percent' ? `+${r.margin_percent} %`
                  : `+${r.margin_percent} % +${r.margin_fixed} €`}
              </td>
              <td style={{ padding: 8, color: '#64748b' }}>{ROUNDINGS.find((x) => x.v === r.rounding)?.label}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                <button onClick={() => delRule(r.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
