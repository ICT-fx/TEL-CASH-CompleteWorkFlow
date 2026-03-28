'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminNewProductPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    brand: '', model: '', storage_capacity: '', color: '', imei: '',
    warranty: '', condition_description: '', grade: '', battery_health: '',
    price: '', compare_at_price: '', stock: '1', category: 'telephones',
    images: '',
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        battery_health: form.battery_health ? parseInt(form.battery_health) : null,
        stock: parseInt(form.stock),
        images: form.images ? form.images.split('\n').filter(Boolean) : [],
        grade: form.grade || null,
      }),
    });

    if (res.ok) {
      router.push('/admin/products');
    } else {
      const data = await res.json();
      setError(data.error || 'Erreur');
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700, margin: '0 auto' }}>
        <Link href="/admin/products">← Produits</Link>
        <h1 style={{ marginTop: 8 }}>Nouveau produit</h1>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Marque *</label>
                <input value={form.brand} onChange={e => update('brand', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Modèle *</label>
                <input value={form.model} onChange={e => update('model', e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Catégorie *</label>
                <select value={form.category} onChange={e => update('category', e.target.value)}>
                  <option value="telephones">Téléphones</option>
                  <option value="accessoires">Accessoires</option>
                </select>
              </div>
              <div className="form-group">
                <label>Grade</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['A', 'B', 'C'].map(g => (
                    <button
                      type="button"
                      key={g}
                      className={`btn btn-sm ${form.grade === g ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => update('grade', form.grade === g ? '' : g)}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Stockage</label>
                <input value={form.storage_capacity} onChange={e => update('storage_capacity', e.target.value)} placeholder="128 Go" />
              </div>
              <div className="form-group">
                <label>Couleur</label>
                <input value={form.color} onChange={e => update('color', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prix *</label>
                <input type="number" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Prix barré</label>
                <input type="number" step="0.01" value={form.compare_at_price} onChange={e => update('compare_at_price', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Stock</label>
                <input type="number" value={form.stock} onChange={e => update('stock', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Santé batterie (%)</label>
                <input type="number" min="0" max="100" value={form.battery_health} onChange={e => update('battery_health', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>IMEI</label>
              <input value={form.imei} onChange={e => update('imei', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Garantie</label>
              <input value={form.warranty} onChange={e => update('warranty', e.target.value)} placeholder="12 mois" />
            </div>
            <div className="form-group">
              <label>Description état</label>
              <textarea value={form.condition_description} onChange={e => update('condition_description', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Images (URLs, une par ligne)</label>
              <textarea value={form.images} onChange={e => update('images', e.target.value)} placeholder="https://..." />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Création...' : 'Créer le produit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
