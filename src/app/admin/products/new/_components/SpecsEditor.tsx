'use client';

import { SPEC_THEMES, type ProductSpecs } from '@/lib/productSpecs';

interface SpecsEditorProps {
  value: ProductSpecs;
  onChange: (next: ProductSpecs) => void;
  prefilledFrom?: string | null;   // modèle source du pré-remplissage (bandeau)
  onPrefill?: () => void;          // « Réinitialiser depuis le modèle »
  canPrefill?: boolean;            // true si le modèle est connu du dictionnaire
}

export function SpecsEditor({ value, onChange, prefilledFrom, onPrefill, canPrefill }: SpecsEditorProps) {
  const setField = (key: keyof ProductSpecs, raw: string, isNumber: boolean) => {
    const v = isNumber ? (raw === '' ? null : Number(raw)) : raw;
    onChange({ ...value, [key]: v } as ProductSpecs);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {prefilledFrom ? (
          <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
            Pré-rempli depuis « {prefilledFrom} »
          </span>
        ) : <span />}
        {canPrefill && onPrefill && (
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onPrefill}>
            Réinitialiser depuis le modèle
          </button>
        )}
      </div>

      {SPEC_THEMES.map((theme) => (
        <div key={theme.title} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: 8 }}>
            {theme.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {theme.fields.map((f) => (
              <div className="admin-form-group" key={f.key}>
                <label className="admin-form-label">{f.label}</label>
                {f.type === 'reseau' ? (
                  <select
                    className="admin-form-select"
                    value={(value[f.key] as string) ?? ''}
                    onChange={(e) => setField(f.key, e.target.value, false)}
                  >
                    <option value="">—</option>
                    <option value="4G">4G</option>
                    <option value="5G">5G</option>
                  </select>
                ) : (
                  <input
                    className="admin-form-input"
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={value[f.key] == null ? '' : String(value[f.key])}
                    onChange={(e) => setField(f.key, e.target.value, f.type === 'number')}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
