'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

export default function AdminNewProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [customBrand, setCustomBrand] = useState(false);
  const PREDEFINED_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Huawei', 'Oppo', ''];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    brand: '', model: '', storage_capacity: '', color: '', imei: '',
    warranty: '', condition_description: '', grade: '', battery_health: '',
    price: '', compare_at_price: '', stock: '1', category: 'telephones',
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

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

    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        battery_health: form.battery_health ? parseInt(form.battery_health) : null,
        stock: parseInt(form.stock),
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

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>
        Nouveau produit
      </h1>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Informations générales</div>
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
                <input className="admin-form-input" value={form.model} onChange={e => update('model', e.target.value)} required placeholder="iPhone 15 Pro Max" />
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
                  {['A', 'B', 'C'].map(g => (
                    <button
                      type="button" key={g}
                      className={`admin-grade-btn ${form.grade === g ? `active-${g}` : ''}`}
                      onClick={() => update('grade', form.grade === g ? '' : g)}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">Stockage</label>
                <input className="admin-form-input" value={form.storage_capacity} onChange={e => update('storage_capacity', e.target.value)} placeholder="128 Go" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Couleur</label>
                <input className="admin-form-input" value={form.color} onChange={e => update('color', e.target.value)} placeholder="Noir" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">IMEI</label>
                <input className="admin-form-input" value={form.imei} onChange={e => update('imei', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Prix & Stock</div>
          </div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">Prix *</label>
                <input className="admin-form-input" type="number" step="0.01" value={form.price} onChange={e => update('price', e.target.value)} required placeholder="499.00" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Prix barré</label>
                <input className="admin-form-input" type="number" step="0.01" value={form.compare_at_price} onChange={e => update('compare_at_price', e.target.value)} placeholder="599.00" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Stock</label>
                <input className="admin-form-input" type="number" value={form.stock} onChange={e => update('stock', e.target.value)} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Santé batterie (%)</label>
                <input className="admin-form-input" type="number" min="0" max="100" value={form.battery_health} onChange={e => update('battery_health', e.target.value)} placeholder="92" />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Garantie</label>
                <input className="admin-form-input" value={form.warranty} onChange={e => update('warranty', e.target.value)} placeholder="12 mois" />
              </div>
            </div>
          </div>
        </div>

        {/* Images */}
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

        {/* Description */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div className="admin-panel-title">Description</div>
          </div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Description de l&apos;état</label>
              <textarea className="admin-form-textarea" value={form.condition_description} onChange={e => update('condition_description', e.target.value)} placeholder="Décrivez l'état du produit..." />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-lg" onClick={() => router.push('/admin/products')}>
            Annuler
          </button>
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-lg" disabled={saving}>
            {saving ? 'Création...' : 'Créer le produit'}
          </button>
        </div>
      </form>
    </div>
  );
}
