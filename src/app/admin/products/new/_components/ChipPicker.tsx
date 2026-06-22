'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ChipPickerProps {
  label: string;
  options: string[];                       // chips prédéfinies
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  placeholder?: string;
  renderLabel?: (value: string) => string; // libellé affiché (valeur stockée inchangée)
}

export function ChipPicker({
  label, options, selected, onChange,
  allowCustom = true, placeholder = 'Ajouter…', renderLabel,
}: ChipPickerProps) {
  const [custom, setCustom] = useState('');

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (v && !selected.includes(v)) onChange([...selected, v]);
    setCustom('');
  };

  // chips affichées = prédéfinies + valeurs custom déjà sélectionnées
  const extra = selected.filter((s) => !options.includes(s));
  const chips = [...options, ...extra];
  const lab = (v: string) => (renderLabel ? renderLabel(v) : v);

  return (
    <div className="admin-form-group">
      <label className="admin-form-label">{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {chips.map((v) => {
          const active = selected.includes(v);
          return (
            <button
              type="button"
              key={v}
              onClick={() => toggle(v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 999,
                border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                background: active ? '#dbeafe' : '#fff',
                color: active ? '#1d4ed8' : '#475569',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              {lab(v)}
              {active && <X className="w-3 h-3" />}
            </button>
          );
        })}
        {allowCustom && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input
              className="admin-form-input"
              style={{ width: 150, padding: '7px 10px' }}
              placeholder={placeholder}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            />
            <button type="button" onClick={addCustom} className="admin-icon-btn" title="Ajouter">
              <Plus className="w-4 h-4" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
