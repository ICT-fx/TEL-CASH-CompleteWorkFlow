'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminEditProductPage() {
  const params = useParams();
  const { profile } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    brand: '', model: '', storage_capacity: '', color: '', imei: '',
    warranty: '', condition_description: '', grade: '', battery_health: '',
    price: '', compare_at_price: '', stock: '', category: 'telephones',
    images: '', is_active: true,
  });

  useEffect(() => {
    if (profile && profile.role !== 'admin') { router.push('/'); return; }
    fetch(`/api/admin/products/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.product) {
          const p = d.product;
          setForm({
            brand: p.brand || '', model: p.model || '',
            storage_capacity: p.storage_capacity || '', color: p.color || '',
            imei: p.imei || '', warranty: p.warranty || '',
            condition_description: p.condition_description || '',
            grade: p.grade || '', battery_health: p.battery_health?.toString() || '',
            price: p.price?.toString() || '', compare_at_price: p.compare_at_price?.toString() || '',
            stock: p.stock?.toString() || '', category: p.category || 'telephones',
            images: (p.images || []).join('\n'), is_active: p.is_active,
          });
        }
        setLoading(false);
      });
  }, [params.id, profile]);

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch(`/api/admin/products/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        battery_health: form.battery_health ? parseInt(form.battery_health) : null,
        stock: parseInt(form.stock),
        price: form.price,
        compare_at_price: form.compare_at_price || null,
        images: form.images ? form.images.split('\n').filter(Boolean) : [],
        grade: form.grade || null,
      }),
    });

    if (res.ok) {
      setMessage('✅ Produit mis à jour');
      setTimeout(() => setMessage(''), 3000);
    } else {
      const data = await res.json();
      setError(data.error || 'Erreur');
    }
    setSaving(false);
  };

  if (loading) return <div className="page"><div className="container"><p>Chargement...</p></div></div>;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 700, margin: '0 auto' }}>
        <Link href="/admin/products">← Produits</Link>
        <h1 style={{ marginTop: 8 }}>Modifier : {form.brand} {form.model}</h1>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Marque</label>
                <input value={form.brand} onChange={e => update('brand', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Modèle</label>
                <input value={form.model} onChange={e => update('model', e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Catégorie</label>
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
                      type="button" key={g}
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
                <input value={form.storage_capacity} onChange={e => update('storage_capacity', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Couleur</label>
                <input value={form.color} onChange={e => update('color', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prix</label>
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
              <input value={form.warranty} onChange={e => update('warranty', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description état</label>
              <textarea value={form.condition_description} onChange={e => update('condition_description', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Images (URLs, une par ligne)</label>
              <textarea value={form.images} onChange={e => update('images', e.target.value)} />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)} />
                {' '}Produit actif (visible sur le site)
              </label>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
