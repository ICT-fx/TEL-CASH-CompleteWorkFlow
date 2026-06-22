'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { DISPLAY_GRADE_ORDER } from '@/lib/products';
import { EMPTY_SPECS, isSpecsEmpty, specsFromIphone, type ProductSpecs } from '@/lib/productSpecs';
import { ChipPicker } from './_components/ChipPicker';
import { PriceGrid, priceKey, type PriceMap } from './_components/PriceGrid';
import { SpecsEditor } from './_components/SpecsEditor';

const PREDEFINED_BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Google', 'OnePlus', 'Huawei', 'Oppo'];
const STORAGE_OPTIONS = ['64 Go', '128 Go', '256 Go', '512 Go', '1 To'];
// Catalogue magasin consolidé en 3 grades client A/B/C (cf. pivot magasin).
const GRADE_OPTIONS = [...DISPLAY_GRADE_ORDER]; // ['A', 'B', 'C']
const COLOR_OPTIONS = ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert', 'Gris', 'Or', 'Rose', 'Argent', 'Violet', 'Minuit', 'Lumière stellaire', 'Graphite', 'Titane naturel'];

export default function AdminNewProductPage() {
  const router = useRouter();

  // Identité
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState(false);
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<'telephones' | 'accessoires'>('telephones');

  // Déclinaisons
  const [storages, setStorages] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [priceMap, setPriceMap] = useState<PriceMap>({});

  // Specs
  const [specs, setSpecs] = useState<ProductSpecs>(EMPTY_SPECS);
  const [specsTouched, setSpecsTouched] = useState(false);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);

  // Photos par couleur
  const [imagesByColor, setImagesByColor] = useState<Record<string, string[]>>({});
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);
  const [dragColor, setDragColor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingColorRef = useRef<string | null>(null);

  // Partagés
  const [warranty, setWarranty] = useState('');
  const [conditionDescription, setConditionDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isApple = brand.trim().toLowerCase() === 'apple';
  const canPrefill = isApple && specsFromIphone(model) != null;

  // Auto-pré-remplissage des specs depuis le dictionnaire iPhone tant que
  // l'utilisateur n'a pas édité la section à la main.
  useEffect(() => {
    if (specsTouched) return;
    const s = isApple ? specsFromIphone(model) : null;
    if (s) { setSpecs(s); setPrefilledFrom(model); }
    else { setSpecs(EMPTY_SPECS); setPrefilledFrom(null); }
  }, [brand, model, specsTouched, isApple]);

  const variantCount = storages.length * grades.length * colors.length;

  // ── Upload images (par couleur) ──────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok && data.url) return data.url as string;
    throw new Error(data.error || 'Upload failed');
  };
  const uploadToColor = useCallback(async (color: string, files: FileList | File[]) => {
    setUploadingColor(color);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) urls.push(await uploadFile(file));
      setImagesByColor((prev) => ({ ...prev, [color]: [...(prev[color] || []), ...urls] }));
    } catch (err: any) {
      setError(err.message || 'Erreur upload');
    }
    setUploadingColor(null);
  }, []);
  const openPicker = (color: string) => { pendingColorRef.current = color; fileInputRef.current?.click(); };
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = pendingColorRef.current;
    if (color && e.target.files && e.target.files.length) uploadToColor(color, e.target.files);
    e.target.value = '';
  };
  const removeColorImage = (color: string, idx: number) =>
    setImagesByColor((prev) => ({ ...prev, [color]: (prev[color] || []).filter((_, i) => i !== idx) }));

  // ── Soumission ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!brand.trim() || !model.trim()) { setError('Marque et modèle sont requis.'); return; }
    if (storages.length === 0) { setError('Sélectionnez au moins une capacité.'); return; }
    if (grades.length === 0) { setError('Sélectionnez au moins un grade.'); return; }
    if (colors.length === 0) { setError('Sélectionnez au moins une couleur.'); return; }

    // Toutes les cases (capacité × grade) doivent avoir un prix > 0.
    for (const s of storages) for (const g of grades) {
      const price = parseFloat(priceMap[priceKey(s, g)]?.price ?? '');
      if (!Number.isFinite(price) || price <= 0) {
        setError(`Prix manquant pour ${s} · Grade ${g}.`);
        return;
      }
    }

    // Au moins une photo par couleur.
    for (const c of colors) {
      if (!imagesByColor[c]?.length) {
        setError(`Ajoutez au moins une photo pour la couleur ${c}.`);
        return;
      }
    }

    const variants: Array<{ storage_capacity: string; grade: string; color: string; price: string; compare_at_price: string | null; images: string[] }> = [];
    for (const s of storages) for (const g of grades) {
      const cell = priceMap[priceKey(s, g)];
      for (const c of colors) {
        variants.push({
          storage_capacity: s,
          grade: g,
          color: c,
          price: cell.price,
          compare_at_price: cell.compareAt?.trim() ? cell.compareAt : null,
          images: imagesByColor[c] || [],
        });
      }
    }

    setSaving(true);
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: brand.trim(),
        model: model.trim(),
        category,
        warranty,
        condition_description: conditionDescription,
        specs: isSpecsEmpty(specs) ? null : specs,
        variants,
      }),
    });

    if (res.ok) {
      router.push('/admin/products');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Erreur lors de la création.');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>
        Nouveau produit
      </h1>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Identité */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Informations générales</div></div>
          <div style={{ padding: 24 }}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Marque *</label>
                <select
                  className="admin-form-select"
                  value={!customBrand && PREDEFINED_BRANDS.includes(brand) ? brand : (customBrand ? 'Autre' : '')}
                  onChange={(e) => {
                    if (e.target.value === 'Autre') { setBrand(''); setCustomBrand(true); }
                    else { setBrand(e.target.value); setCustomBrand(false); }
                  }}
                  required={!customBrand}
                >
                  <option value="">Sélectionner...</option>
                  {PREDEFINED_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="Autre">Autre (préciser)...</option>
                </select>
                {customBrand && (
                  <input className="admin-form-input" style={{ marginTop: 8 }} placeholder="Saisissez la marque..."
                    value={brand} onChange={(e) => setBrand(e.target.value)} required />
                )}
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Modèle *</label>
                <input className="admin-form-input" value={model} onChange={(e) => setModel(e.target.value)}
                  required placeholder="iPhone 11" />
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Catégorie *</label>
              <select className="admin-form-select" value={category}
                onChange={(e) => setCategory(e.target.value as 'telephones' | 'accessoires')}>
                <option value="telephones">Téléphones</option>
                <option value="accessoires">Accessoires</option>
              </select>
            </div>
          </div>
        </div>

        {/* Déclinaisons */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Déclinaisons</div></div>
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <ChipPicker label="Capacités *" options={STORAGE_OPTIONS} selected={storages} onChange={setStorages} placeholder="ex. 1 To" />
            <ChipPicker label="Grades *" options={GRADE_OPTIONS} selected={grades} onChange={setGrades} allowCustom={false} renderLabel={(g) => `Grade ${g}`} />
            <ChipPicker label="Couleurs *" options={COLOR_OPTIONS} selected={colors} onChange={setColors} placeholder="ex. Bleu nuit" />
            {variantCount > 0 && (
              <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600 }}>
                Cette saisie créera {variantCount} variante{variantCount > 1 ? 's' : ''} ({storages.length} × {grades.length} × {colors.length}).
              </div>
            )}
          </div>
        </div>

        {/* Prix */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Prix par capacité × grade</div></div>
          <div style={{ padding: 24 }}>
            <PriceGrid storages={storages} grades={grades} value={priceMap} onChange={setPriceMap} gradeLabel={(g) => `Grade ${g}`} />
            <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#94a3b8' }}>
              Le prix dépend du stockage et du grade (état), et il est partagé entre les couleurs. Pas de stock à saisir : catalogue magasin en sell-to-order.
            </p>
          </div>
        </div>

        {/* Photos par couleur */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Photos par couleur</div></div>
          <div style={{ padding: 24 }}>
            {colors.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Sélectionnez d&apos;abord au moins une couleur ci-dessus.</p>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {colors.map((c) => {
                  const imgs = imagesByColor[c] || [];
                  return (
                    <div key={c}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem', marginBottom: 8 }}>
                        {c} {imgs.length > 0 ? <span style={{ color: '#16a34a', fontWeight: 600 }}>· {imgs.length} photo{imgs.length > 1 ? 's' : ''}</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>· photo requise</span>}
                      </div>
                      <div
                        className={`admin-dropzone ${dragColor === c ? 'dragover' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragColor(c); }}
                        onDragLeave={() => setDragColor((d) => (d === c ? null : d))}
                        onDrop={(e) => { e.preventDefault(); setDragColor(null); if (e.dataTransfer.files.length) uploadToColor(c, e.dataTransfer.files); }}
                        onClick={() => openPicker(c)}
                      >
                        {uploadingColor === c ? (
                          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
                        ) : (
                          <>
                            <Upload className="w-7 h-7" style={{ color: '#94a3b8', margin: '0 auto' }} />
                            <div className="admin-dropzone-text">Photos pour « {c} »</div>
                            <div className="admin-dropzone-hint">Glissez ou cliquez · JPG, PNG, WebP · 1 minimum</div>
                          </>
                        )}
                      </div>
                      {imgs.length > 0 && (
                        <div className="admin-image-preview">
                          {imgs.map((url, i) => (
                            <div key={i} className="admin-image-thumb">
                              <img src={url} alt={`${c} ${i + 1}`} />
                              <button type="button" className="admin-image-thumb-remove" onClick={() => removeColorImage(c, i)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
                  style={{ display: 'none' }} onChange={onInputChange} />
              </div>
            )}
          </div>
        </div>

        {/* Caractéristiques techniques */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Caractéristiques techniques</div></div>
          <div style={{ padding: 24 }}>
            <SpecsEditor
              value={specs}
              onChange={(next) => { setSpecs(next); setSpecsTouched(true); }}
              prefilledFrom={prefilledFrom}
              canPrefill={canPrefill}
              onPrefill={() => {
                const s = specsFromIphone(model);
                if (s) { setSpecs(s); setPrefilledFrom(model); setSpecsTouched(false); }
              }}
            />
          </div>
        </div>

        {/* Garantie & description */}
        <div className="admin-panel">
          <div className="admin-panel-header"><div className="admin-panel-title">Garantie & description</div></div>
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Garantie</label>
              <input className="admin-form-input" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="24 mois incluse" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Description de l&apos;état</label>
              <textarea className="admin-form-textarea" value={conditionDescription}
                onChange={(e) => setConditionDescription(e.target.value)} placeholder="Décrivez l'état du produit..." />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-lg" onClick={() => router.push('/admin/products')}>
            Annuler
          </button>
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-lg" disabled={saving}>
            {saving ? 'Création...' : `Créer ${variantCount > 0 ? variantCount + ' variante' + (variantCount > 1 ? 's' : '') : 'le produit'}`}
          </button>
        </div>
      </form>
    </div>
  );
}
