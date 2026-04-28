'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Upload, X } from 'lucide-react';

export default function AdminEditProductPage() {
  const router = useRouter();
  const params = useParams();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [customBrand, setCustomBrand] = useState(false);
  const PREDEFINED_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Huawei', 'Oppo', ''];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    brand: '', model: '', storage_capacity: '', color: '', imei: '',
    warranty: '', condition_description: '', grade: '', battery_health: '',
    price: '', compare_at_price: '', stock: '', category: 'telephones',
    is_active: true,
  });

  useEffect(() => {
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
            is_active: p.is_active,
          });
          setImages(p.images || []);
          if (p.brand && !PREDEFINED_BRANDS.includes(p.brand)) {
            setCustomBrand(true);
          }
        }
        setLoading(false);
      });
  }, [params.id]);

  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok && data.url) return data.url;
    throw new Error(data.error || 'Upload failed');
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        urls.push(url);
      }
      setImages(prev => [...prev, ...urls]);
    } catch (err: any) {
      setError(err.message || 'Erreur upload');
    }
    setUploading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

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
        images,
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>
        Modifier : {form.brand} {form.model}
      </h1>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {message && <div className="admin-alert admin-alert-success">{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Informations générales</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)} />
              Produit actif
            </label>
          </div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Marque *</label>
                <select 
                  className="admin-form-select" 
                  value={PREDEFINED_BRANDS.includes(form.brand) ? form.brand : 'Autre'} 
                  onChange={e => {
                    if (e.target.value !== 'Autre') {
                      update('brand', e.target.value);
                      setCustomBrand(false);
                    } else {
                      update('brand', '');
                      setCustomBrand(true);
                    }
                  }} 
                  required={!customBrand}
                >
                  <option value="">Sélectionner...</option>
                  <option value="Apple">Apple</option>
                  <option value="Samsung">Samsung</option>
                  <option value="Xiaomi">Xiaomi</option>
                  <option value="Google">Google</option>
                  <option value="OnePlus">OnePlus</option>
                  <option value="Huawei">Huawei</option>
                  <option value="Oppo">Oppo</option>
                  <option value="Autre">Autre (préciser)...</option>
                </select>
                {customBrand && (
                  <input 
                    className="admin-form-input" 
                    style={{ marginTop: 8 }} 
                    placeholder="Saisissez la marque..." 
                    value={form.brand} 
                    onChange={e => update('brand', e.target.value)} 
                    required 
                  />
                )}
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Modèle *</label>
                <input className="admin-form-input" value={form.model} onChange={e => update('model', e.target.value)} required />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Catégorie *</label>
                <select className="admin-form-select" value={form.category} onChange={e => update('category', e.target.value)}>
                  <option value="telephones">Téléphones</option>
                  <option value="accessoires">Accessoires</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Grade</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Parfait État', 'Très Bon État', 'État Correct'].map(g => (
                    <button
                      type="button" key={g}
                      className={`admin-grade-btn ${form.grade === g ? `active-${g === 'Parfait État' ? 'A' : g === 'Très Bon État' ? 'B' : 'C'}` : ''}`}
                      onClick={() => update('grade', form.grade === g ? '' : g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">Stockage</label>
                <input className="admin-form-input" value={form.storage_capacity} onChange={e => update('storage_capacity', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Couleur</label>
                <input className="admin-form-input" value={form.color} onChange={e => update('color', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">IMEI</label>
                <input className="admin-form-input" value={form.imei} onChange={e => update('imei', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Prix & Stock</div>
          </div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">Prix *</label>
                <input className="admin-form-input" type="number" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Prix barré</label>
                <input className="admin-form-input" type="number" step="0.01" value={form.compare_at_price} onChange={e => update('compare_at_price', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Stock</label>
                <input className="admin-form-input" type="number" value={form.stock} onChange={e => update('stock', e.target.value)} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Santé batterie (%)</label>
                <input className="admin-form-input" type="number" min="0" max="100" value={form.battery_health} onChange={e => update('battery_health', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Garantie</label>
                <input className="admin-form-input" value={form.warranty} onChange={e => update('warranty', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Images</div>
          </div>
          <div style={{ padding: 24 }}>
            <div
              className={`admin-dropzone ${dragover ? 'dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
              ) : (
                <>
                  <Upload className="w-8 h-8" style={{ color: '#94a3b8', margin: '0 auto' }} />
                  <div className="admin-dropzone-text">Glissez vos images ici</div>
                  <div className="admin-dropzone-hint">ou cliquez pour parcourir · JPG, PNG, WebP · Max 5 Mo</div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
            {images.length > 0 && (
              <div className="admin-image-preview">
                {images.map((url, i) => (
                  <div key={i} className="admin-image-thumb">
                    <img src={url} alt={`Image ${i + 1}`} />
                    <button type="button" className="admin-image-thumb-remove" onClick={() => removeImage(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Description</div>
          </div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Description de l&apos;état</label>
              <textarea className="admin-form-textarea" value={form.condition_description} onChange={e => update('condition_description', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-lg" onClick={() => router.push('/admin/products')}>
            Annuler
          </button>
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-lg" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
