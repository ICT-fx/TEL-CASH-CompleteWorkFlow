'use client';

export interface PriceCell { price: string; compareAt: string }
export type PriceMap = Record<string, PriceCell>;

export function priceKey(storage: string, grade: string): string {
  return `${storage}|${grade}`;
}

interface PriceGridProps {
  storages: string[];
  grades: string[];
  value: PriceMap;
  onChange: (next: PriceMap) => void;
  gradeLabel?: (g: string) => string;
}

export function PriceGrid({ storages, grades, value, onChange, gradeLabel }: PriceGridProps) {
  const setCell = (k: string, patch: Partial<PriceCell>) => {
    const cur = value[k] ?? { price: '', compareAt: '' };
    onChange({ ...value, [k]: { ...cur, ...patch } });
  };

  // Remplit toutes les cellules avec le 1er prix saisi (helper « appliquer à tout »).
  const applyAll = () => {
    const first = Object.values(value).find((c) => c && c.price.trim());
    if (!first) return;
    const next: PriceMap = { ...value };
    for (const s of storages) for (const g of grades) {
      const k = priceKey(s, g);
      next[k] = { price: first.price, compareAt: (value[k]?.compareAt ?? first.compareAt) };
    }
    onChange(next);
  };

  if (storages.length === 0 || grades.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sélectionnez au moins une capacité et un grade.</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={applyAll}>
          Appliquer le 1er prix à toutes les cases
        </button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {storages.map((s) =>
          grades.map((g) => {
            const k = priceKey(s, g);
            const cell = value[k] ?? { price: '', compareAt: '' };
            return (
              <div
                key={k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 130px',
                  gap: 10, alignItems: 'center',
                  padding: '8px 12px', borderRadius: 10, background: '#f8fafc',
                }}
              >
                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.88rem' }}>
                  {s} · {gradeLabel ? gradeLabel(g) : `Grade ${g}`}
                </div>
                <input
                  className="admin-form-input" type="number" step="0.01" min="0"
                  placeholder="Prix *" value={cell.price}
                  onChange={(e) => setCell(k, { price: e.target.value })}
                />
                <input
                  className="admin-form-input" type="number" step="0.01" min="0"
                  placeholder="Prix barré" value={cell.compareAt}
                  onChange={(e) => setCell(k, { compareAt: e.target.value })}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
