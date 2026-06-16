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
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 12 }}>
        Le filtre grade n'affecte que l'affichage. « Appliquer les prix » recalcule et
        écrit toutes les variantes (A, B, C) de la marque sélectionnée — nécessaire pour
        garantir la cohérence A &gt; B &gt; C.
      </p>
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

interface RuleTarget { brand?: string | null; model?: string | null; product_id?: string | null }
interface ModelOption { brand: string; model: string; label: string }
interface ProductOption { id: string; label: string }

function RulesEditor({ rules, onChange }: { rules: Rule[]; onChange: () => void }) {
  const [form, setForm] = useState({
    scope_level: 'global' as ScopeLevel,
    grade: '' as '' | 'A' | 'B' | 'C',
    margin_type: 'percent' as 'percent' | 'fixed',
    margin_percent: 20, margin_fixed: 0, rounding: 'ends_99' as Rounding,
  });
  const [options, setOptions] = useState<{ brands: string[]; models: ModelOption[] }>({ brands: [], models: [] });
  const [selBrands, setSelBrands] = useState<Set<string>>(new Set());
  const [selModels, setSelModels] = useState<Map<string, ModelOption>>(new Map());
  const [selProducts, setSelProducts] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/margins/options').then((r) => r.json()).then((d) =>
      setOptions({ brands: d.brands ?? [], models: d.models ?? [] })
    );
  }, []);

  const buildTargets = (): RuleTarget[] => {
    if (form.scope_level === 'global') return [{}];
    if (form.scope_level === 'brand') return Array.from(selBrands).map((b) => ({ brand: b }));
    if (form.scope_level === 'model') return Array.from(selModels.values()).map((m) => ({ brand: m.brand, model: m.model }));
    return selProducts.map((p) => ({ product_id: p.id }));
  };

  // Combien de cibles sélectionnées ont DÉJÀ une règle (même scope+grade) → seront modifiées.
  const targets = buildTargets();
  const overlap = targets.filter((t) =>
    rules.some((r) =>
      r.scope_level === form.scope_level &&
      (r.grade ?? null) === (form.grade || null) &&
      (r.brand ?? null) === (t.brand ?? null) &&
      (r.model ?? null) === (t.model ?? null) &&
      (r.product_id ?? null) === (t.product_id ?? null)
    )
  ).length;

  const resetSelection = () => { setSelBrands(new Set()); setSelModels(new Map()); setSelProducts([]); };

  const addRule = async () => {
    if (form.scope_level !== 'global' && targets.length === 0) {
      setLocalMsg('Sélectionne au moins une cible.');
      return;
    }
    setBusy(true);
    setLocalMsg(null);
    const r = await fetch('/api/admin/margins/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope_level: form.scope_level, grade: form.grade || null,
        margin_type: form.margin_type, margin_percent: form.margin_percent,
        margin_fixed: form.margin_fixed, rounding: form.rounding,
        targets,
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) { setLocalMsg(d.error); return; }
    setLocalMsg(`${d.created ?? 0} créée(s), ${d.updated ?? 0} modifiée(s).`);
    resetSelection();
    onChange();
  };
  const delRule = async (id: string) => {
    await fetch(`/api/admin/margins/rules/${id}`, { method: 'DELETE' });
    onChange();
  };

  const toggleBrand = (b: string) =>
    setSelBrands((prev) => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; });
  const toggleModel = (m: ModelOption) =>
    setSelModels((prev) => { const n = new Map(prev); const k = `${m.brand}|${m.model}`; n.has(k) ? n.delete(k) : n.set(k, m); return n; });
  const toggleProduct = (p: ProductOption) =>
    setSelProducts((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]);

  const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 };

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Règles de marge</h2>

      {/* Ligne 1 : portée + marge */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={form.scope_level} onChange={(e) => { setForm({ ...form, scope_level: e.target.value as ScopeLevel }); resetSelection(); }} style={inputStyle}>
          <option value="global">Global</option>
          <option value="brand">Marque</option>
          <option value="model">Modèle</option>
          <option value="product">Produit</option>
        </select>
        <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as '' | 'A' | 'B' | 'C' })} style={inputStyle}>
          <option value="">Tous grades</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
        <select value={form.margin_type} onChange={(e) => setForm({ ...form, margin_type: e.target.value as 'percent' | 'fixed' })} style={inputStyle}>
          <option value="percent">Pourcentage (%)</option><option value="fixed">Montant (€)</option>
        </select>
        {form.margin_type === 'percent'
          ? <input type="number" placeholder="%" value={form.margin_percent} onChange={(e) => setForm({ ...form, margin_percent: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />
          : <input type="number" placeholder="€" value={form.margin_fixed} onChange={(e) => setForm({ ...form, margin_fixed: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />}
        <select value={form.rounding} onChange={(e) => setForm({ ...form, rounding: e.target.value as Rounding })} style={inputStyle}>
          {ROUNDINGS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
      </div>

      {/* Ligne 2 : sélecteur de cibles selon la portée */}
      {form.scope_level === 'brand' && (
        <CheckList
          items={options.brands.map((b) => ({ value: b, label: b }))}
          selected={selBrands} onToggle={toggleBrand} placeholder="Filtrer les marques…"
        />
      )}
      {form.scope_level === 'model' && (
        <CheckList
          items={options.models.map((m) => ({ value: `${m.brand}|${m.model}`, label: m.label }))}
          selected={new Set(selModels.keys())}
          onToggle={(key) => { const m = options.models.find((x) => `${x.brand}|${x.model}` === key); if (m) toggleModel(m); }}
          placeholder="Filtrer les groupes (modèles)…"
        />
      )}
      {form.scope_level === 'product' && (
        <ProductPicker selected={selProducts} onToggle={toggleProduct} />
      )}

      {/* Récap sélection + avertissement chevauchement */}
      {form.scope_level !== 'global' && (
        <div style={{ fontSize: '0.8rem', color: '#64748b', margin: '10px 0' }}>
          {targets.length} cible(s) sélectionnée(s).
          {overlap > 0 && (
            <span style={{ color: '#b45309' }}> {overlap} ont déjà une règle (même grade) et seront <b>modifiées</b>.</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 16 }}>
        <button onClick={addRule} disabled={busy} style={{ padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
          {busy ? 'Enregistrement…' : 'Ajouter / Mettre à jour'}
        </button>
        {localMsg && <span style={{ fontSize: '0.82rem', color: '#16a34a' }}>{localMsg}</span>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: 8 }}>
                {r.scope_level}
                {r.brand ? ` · ${r.brand}` : ''}{r.model ? ` ${r.model}` : ''}
                {r.product_id ? ` · produit ${r.product_id.slice(0, 8)}…` : ''}
                {r.grade ? ` · grade ${r.grade}` : ''}
              </td>
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

// Liste filtrable à cases à cocher (marques, modèles).
function CheckList({ items, selected, onToggle, placeholder }: {
  items: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  placeholder: string;
}) {
  const [filter, setFilter] = useState('');
  const f = filter.trim().toLowerCase();
  const shown = f ? items.filter((i) => i.label.toLowerCase().includes(f)) : items;
  return (
    <div style={{ maxWidth: 420 }}>
      <input placeholder={placeholder} value={filter} onChange={(e) => setFilter(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 6 }} />
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
        {shown.slice(0, 300).map((i) => (
          <label key={i.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.has(i.value)} onChange={() => onToggle(i.value)} />
            {i.label}
          </label>
        ))}
        {shown.length === 0 && <div style={{ padding: 10, color: '#94a3b8', fontSize: '0.8rem' }}>Aucun résultat</div>}
      </div>
    </div>
  );
}

// Recherche produit côté serveur + sélection multiple (chips).
function ProductPicker({ selected, onToggle }: {
  selected: ProductOption[];
  onToggle: (p: ProductOption) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProductOption[]>([]);
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/admin/margins/products-search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setResults(d.products ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const selSet = new Set(selected.map((s) => s.id));
  return (
    <div style={{ maxWidth: 480 }}>
      <input placeholder="Rechercher un produit (marque, modèle)…" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 6 }} />
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {selected.map((p) => (
            <span key={p.id} onClick={() => onToggle(p)} title="Retirer"
              style={{ fontSize: '0.75rem', background: '#eef2ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, cursor: 'pointer' }}>
              {p.label} ✕
            </span>
          ))}
        </div>
      )}
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
        {results.map((p) => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={selSet.has(p.id)} onChange={() => onToggle(p)} />
            {p.label}
          </label>
        ))}
        {q.trim() && results.length === 0 && <div style={{ padding: 10, color: '#94a3b8', fontSize: '0.8rem' }}>Aucun résultat</div>}
      </div>
    </div>
  );
}
