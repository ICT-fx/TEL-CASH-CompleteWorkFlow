'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Rounding, ScopeLevel } from '@/lib/margins';

const NO_STORE: RequestInit = { cache: 'no-store' };

interface StatsResp { totalMarginEuro: number; salesCount: number; avgMarginPct: number; }
interface PreviewRow {
  productId: string; brand: string; model: string; grade: string | null;
  storage: string | null; color: string | null; cost: number;
  oldPrice: number; newPrice: number; marginPct: number;
  ruleApplied: string | null; coherenceAdjusted: boolean; lowMargin: boolean;
  compareAtPrice: number | null;
}
interface Rule {
  id: string; scope_level: ScopeLevel; brand: string | null; model: string | null;
  product_id: string | null; grade: 'A' | 'B' | 'C' | null;
  margin_type: 'percent' | 'fixed' | 'combined'; margin_percent: number | null; margin_fixed: number | null;
  rounding: Rounding;
  strike_enabled: boolean | null; strike_type: 'percent' | 'fixed' | null;
  strike_value: number | null; strike_rounding: Rounding | null;
}
interface ModelOption { brand: string; model: string; label: string }
interface ProductOption { id: string; label: string }

// Valeurs éditables partagées entre la création et la modification d'une règle.
interface RuleFormValues {
  grade: '' | 'A' | 'B' | 'C';
  margin_type: 'percent' | 'fixed';
  margin_percent: number;
  margin_fixed: number;
  rounding: Rounding;
  strike_enabled: boolean;
  strike_type: 'percent' | 'fixed';
  strike_value: number;
  strike_rounding: Rounding;
}

const DEFAULT_FORM: RuleFormValues = {
  grade: '', margin_type: 'percent', margin_percent: 20, margin_fixed: 0, rounding: 'ends_99',
  strike_enabled: false, strike_type: 'percent', strike_value: 20, strike_rounding: 'ends_99',
};

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
const inputStyle = { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 };

function ruleToForm(r: Rule): RuleFormValues {
  return {
    grade: (r.grade ?? '') as RuleFormValues['grade'],
    margin_type: r.margin_type === 'fixed' ? 'fixed' : 'percent',
    margin_percent: r.margin_percent ?? 0,
    margin_fixed: r.margin_fixed ?? 0,
    rounding: r.rounding,
    strike_enabled: !!r.strike_enabled,
    strike_type: r.strike_type === 'fixed' ? 'fixed' : 'percent',
    strike_value: r.strike_value ?? 0,
    strike_rounding: r.strike_rounding ?? 'ends_99',
  };
}
function formToBody(v: RuleFormValues) {
  return {
    grade: v.grade || null,
    margin_type: v.margin_type, margin_percent: v.margin_percent, margin_fixed: v.margin_fixed,
    rounding: v.rounding,
    strike_enabled: v.strike_enabled, strike_type: v.strike_type,
    strike_value: v.strike_value, strike_rounding: v.strike_rounding,
  };
}

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
    const r = await fetch('/api/admin/margins/stats', NO_STORE);
    const d = await r.json(); setStats(d.stats);
  }, []);
  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/admin/margins/settings', NO_STORE);
    const d = await r.json();
    if (d.settings) setSettings({
      coherence_enabled: !!d.settings.coherence_enabled,
      coherence_min_gap_percent: Number(d.settings.coherence_min_gap_percent) || 5,
    });
  }, []);
  const loadRules = useCallback(async () => {
    const r = await fetch('/api/admin/margins/rules', NO_STORE);
    const d = await r.json(); setRules(d.rules ?? []);
  }, []);
  const loadPreview = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (brand) qs.set('brand', brand);
    if (grade) qs.set('grade', grade);
    const r = await fetch(`/api/admin/margins/preview?${qs}`, NO_STORE);
    const d = await r.json();
    setRows(d.rows ?? []); setLoading(false);
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
    setMessage(`${d.updated ?? 0} prix mis à jour.`);
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

      <RulesList rules={rules} onChange={() => { loadRules(); loadPreview(); }} />

      <div className="admin-filters" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '24px 0 16px' }}>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ ...inputStyle, padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} style={{ ...inputStyle, padding: '8px 12px', borderRadius: 8 }}>
          <option value="">Tous grades</option>
          <option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option>
        </select>
        <button onClick={apply} disabled={applying}
          style={{ marginLeft: 'auto', padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
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
              <th style={{ padding: 10 }}>Barré</th>
              <th style={{ padding: 10 }}>Marge</th>
              <th style={{ padding: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
            ) : rows.map((r) => (
              <tr key={r.productId} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: 10 }}>{r.brand} {r.model}{r.storage ? ` · ${r.storage}` : ''}{r.color ? ` · ${r.color}` : ''}</td>
                <td style={{ padding: 10 }}>{r.grade ?? '—'}</td>
                <td style={{ padding: 10 }}>{eur(r.cost)}</td>
                <td style={{ padding: 10, color: '#94a3b8' }}>{eur(r.oldPrice)}</td>
                <td style={{ padding: 10, fontWeight: 600, color: r.newPrice !== r.oldPrice ? '#0f172a' : '#64748b' }}>{eur(r.newPrice)}</td>
                <td style={{ padding: 10, color: '#94a3b8', textDecoration: r.compareAtPrice ? 'line-through' : 'none' }}>{r.compareAtPrice ? eur(r.compareAtPrice) : '—'}</td>
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

// Champs marge + prix barré, partagés création/édition.
function RuleFields({ values, onChange }: { values: RuleFormValues; onChange: (v: RuleFormValues) => void }) {
  const set = (patch: Partial<RuleFormValues>) => onChange({ ...values, ...patch });
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={values.grade} onChange={(e) => set({ grade: e.target.value as RuleFormValues['grade'] })} style={inputStyle}>
          <option value="">Tous grades</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
        <select value={values.margin_type} onChange={(e) => set({ margin_type: e.target.value as 'percent' | 'fixed' })} style={inputStyle}>
          <option value="percent">Pourcentage (%)</option><option value="fixed">Montant (€)</option>
        </select>
        {values.margin_type === 'percent'
          ? <input type="number" placeholder="%" value={values.margin_percent} onChange={(e) => set({ margin_percent: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />
          : <input type="number" placeholder="€" value={values.margin_fixed} onChange={(e) => set({ margin_fixed: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />}
        <select value={values.rounding} onChange={(e) => set({ rounding: e.target.value as Rounding })} style={inputStyle}>
          {ROUNDINGS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#475569' }}>
          <input type="checkbox" checked={values.strike_enabled} onChange={(e) => set({ strike_enabled: e.target.checked })} />
          Prix barré
        </label>
        {values.strike_enabled && (
          <>
            <select value={values.strike_type} onChange={(e) => set({ strike_type: e.target.value as 'percent' | 'fixed' })} style={inputStyle}>
              <option value="percent">% en moins</option><option value="fixed">€ en moins</option>
            </select>
            <input type="number" value={values.strike_value} onChange={(e) => set({ strike_value: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />
            <select value={values.strike_rounding} onChange={(e) => set({ strike_rounding: e.target.value as Rounding })} style={inputStyle}>
              {ROUNDINGS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </>
        )}
      </div>
    </>
  );
}

function RulesEditor({ rules, onChange }: { rules: Rule[]; onChange: () => void }) {
  const [scope, setScope] = useState<ScopeLevel>('global');
  const [values, setValues] = useState<RuleFormValues>(DEFAULT_FORM);
  const [options, setOptions] = useState<{ brands: string[]; models: ModelOption[] }>({ brands: [], models: [] });
  const [selBrands, setSelBrands] = useState<Set<string>>(new Set());
  const [selModels, setSelModels] = useState<Map<string, ModelOption>>(new Map());
  const [selProducts, setSelProducts] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/margins/options', NO_STORE).then((r) => r.json()).then((d) =>
      setOptions({ brands: d.brands ?? [], models: d.models ?? [] })
    );
  }, []);

  const buildTargets = () => {
    if (scope === 'global') return [{}];
    if (scope === 'brand') return Array.from(selBrands).map((b) => ({ brand: b }));
    if (scope === 'model') return Array.from(selModels.values()).map((m) => ({ brand: m.brand, model: m.model }));
    return selProducts.map((p) => ({ product_id: p.id }));
  };
  const targets = buildTargets();
  const overlap = targets.filter((t: { brand?: string; model?: string; product_id?: string }) =>
    rules.some((r) =>
      r.scope_level === scope && (r.grade ?? null) === (values.grade || null) &&
      (r.brand ?? null) === (t.brand ?? null) && (r.model ?? null) === (t.model ?? null) &&
      (r.product_id ?? null) === (t.product_id ?? null)
    )
  ).length;

  const resetSelection = () => { setSelBrands(new Set()); setSelModels(new Map()); setSelProducts([]); };

  const addRule = async () => {
    if (scope !== 'global' && targets.length === 0) { setLocalMsg('Sélectionne au moins une cible.'); return; }
    setBusy(true); setLocalMsg(null);
    const r = await fetch('/api/admin/margins/rules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope_level: scope, ...formToBody(values), targets }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) { setLocalMsg(d.error); return; }
    setLocalMsg(`${d.created ?? 0} créée(s), ${d.updated ?? 0} modifiée(s).`);
    resetSelection();
    onChange();
  };

  const toggleBrand = (b: string) => setSelBrands((p) => { const n = new Set(p); n.has(b) ? n.delete(b) : n.add(b); return n; });
  const toggleModel = (m: ModelOption) => setSelModels((p) => { const n = new Map(p); const k = `${m.brand}|${m.model}`; n.has(k) ? n.delete(k) : n.set(k, m); return n; });
  const toggleProduct = (pr: ProductOption) => setSelProducts((p) => p.some((x) => x.id === pr.id) ? p.filter((x) => x.id !== pr.id) : [...p, pr]);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Règles de marge</h2>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={scope} onChange={(e) => { setScope(e.target.value as ScopeLevel); resetSelection(); }} style={inputStyle}>
          <option value="global">Global</option>
          <option value="brand">Marque</option>
          <option value="model">Modèle</option>
          <option value="product">Produit</option>
        </select>
      </div>

      {scope === 'brand' && (
        <CheckList items={options.brands.map((b) => ({ value: b, label: b }))} selected={selBrands} onToggle={toggleBrand} placeholder="Filtrer les marques…" />
      )}
      {scope === 'model' && (
        <CheckList items={options.models.map((m) => ({ value: `${m.brand}|${m.model}`, label: m.label }))}
          selected={new Set(selModels.keys())}
          onToggle={(key) => { const m = options.models.find((x) => `${x.brand}|${x.model}` === key); if (m) toggleModel(m); }}
          placeholder="Filtrer les groupes (modèles)…" />
      )}
      {scope === 'product' && <ProductPicker selected={selProducts} onToggle={toggleProduct} />}

      <div style={{ marginTop: 12 }}>
        <RuleFields values={values} onChange={setValues} />
      </div>

      {scope !== 'global' && (
        <div style={{ fontSize: '0.8rem', color: '#64748b', margin: '10px 0' }}>
          {targets.length} cible(s) sélectionnée(s).
          {overlap > 0 && <span style={{ color: '#b45309' }}> {overlap} ont déjà une règle (même grade) et seront <b>modifiées</b>.</span>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button onClick={addRule} disabled={busy} style={{ padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>
          {busy ? 'Enregistrement…' : 'Ajouter / Mettre à jour'}
        </button>
        {localMsg && <span style={{ fontSize: '0.82rem', color: '#16a34a' }}>{localMsg}</span>}
      </div>
    </div>
  );
}

function ruleTargetLabel(r: Rule): string {
  const g = r.grade ? ` · grade ${r.grade}` : '';
  if (r.scope_level === 'brand') return `Marque · ${r.brand}${g}`;
  if (r.scope_level === 'model') return `Modèle · ${r.brand} ${r.model}${g}`;
  if (r.scope_level === 'product') return `Produit · ${r.product_id?.slice(0, 8)}…${g}`;
  return `Global${g}`;
}
function marginLabel(r: Rule): string {
  if (r.margin_type === 'fixed') return `+${r.margin_fixed} €`;
  if (r.margin_type === 'percent') return `+${r.margin_percent} %`;
  return `+${r.margin_percent} % +${r.margin_fixed} €`;
}
function strikeLabel(r: Rule): string {
  if (!r.strike_enabled) return '—';
  return r.strike_type === 'fixed' ? `−${r.strike_value} €` : `−${r.strike_value} %`;
}

// Section « Mes règles » : liste de toutes les règles, modifiables en ligne.
function RulesList({ rules, onChange }: { rules: Rule[]; onChange: () => void }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Mes règles ({rules.length})</h2>
      {rules.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Aucune règle pour l'instant. Le prix de vente reste égal au prix fournisseur tant qu'aucune règle n'est appliquée.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b' }}>
              <th style={{ padding: 8 }}>Cible</th>
              <th style={{ padding: 8 }}>Marge</th>
              <th style={{ padding: 8 }}>Barré</th>
              <th style={{ padding: 8 }}>Arrondi</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => <RuleRow key={r.id} rule={r} onChange={onChange} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RuleRow({ rule, onChange }: { rule: Rule; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<RuleFormValues>(() => ruleToForm(rule));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await fetch(`/api/admin/margins/rules/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formToBody(values)),
    });
    setBusy(false); setEditing(false); onChange();
  };
  const del = async () => {
    await fetch(`/api/admin/margins/rules/${rule.id}`, { method: 'DELETE' });
    onChange();
  };

  if (editing) {
    return (
      <tr style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
        <td style={{ padding: 8, verticalAlign: 'top' }}>{ruleTargetLabel(rule)}</td>
        <td style={{ padding: 8 }} colSpan={3}>
          <RuleFields values={values} onChange={setValues} />
        </td>
        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
          <button onClick={save} disabled={busy} style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Enregistrer</button>
          <button onClick={() => { setValues(ruleToForm(rule)); setEditing(false); }} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>Annuler</button>
        </td>
      </tr>
    );
  }
  return (
    <tr style={{ borderTop: '1px solid #f1f5f9' }}>
      <td style={{ padding: 8 }}>{ruleTargetLabel(rule)}</td>
      <td style={{ padding: 8 }}>{marginLabel(rule)}</td>
      <td style={{ padding: 8, color: rule.strike_enabled ? '#0f172a' : '#94a3b8' }}>{strikeLabel(rule)}</td>
      <td style={{ padding: 8, color: '#64748b' }}>{ROUNDINGS.find((x) => x.v === rule.rounding)?.label}</td>
      <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button onClick={() => setEditing(true)} style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Modifier</button>
        <button onClick={del} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>Supprimer</button>
      </td>
    </tr>
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
      const r = await fetch(`/api/admin/margins/products-search?q=${encodeURIComponent(q)}`, NO_STORE);
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
