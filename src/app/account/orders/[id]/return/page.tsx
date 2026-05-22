'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Package, ImagePlus, Trash2, Loader2,
  ShieldAlert, CheckCircle2, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const REASONS = [
  { value: 'retractation',     label: 'Rétractation (14 jours légaux)', hint: 'Vous avez changé d\'avis, dans les 14 jours après réception.' },
  { value: 'defective',        label: 'Produit défectueux',              hint: 'Le téléphone présente un défaut technique.' },
  { value: 'not_as_described', label: 'Non conforme à la description',  hint: 'L\'état ou les caractéristiques diffèrent de l\'annonce.' },
  { value: 'wrong_item',       label: 'Mauvais article reçu',            hint: 'Vous avez reçu un produit différent de votre commande.' },
  { value: 'other',            label: 'Autre',                           hint: '' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  requested:   { label: 'Demande en cours d\'examen',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved:    { label: 'Approuvée',                     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  label_sent:  { label: 'Étiquette envoyée',             color: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_transit:  { label: 'Colis en transit',              color: 'bg-violet-50 text-violet-700 border-violet-200' },
  received:    { label: 'Colis reçu',                    color: 'bg-slate-50 text-slate-700 border-slate-200' },
  inspecting:  { label: 'Inspection en cours',           color: 'bg-slate-50 text-slate-700 border-slate-200' },
  refunded:    { label: 'Remboursé',                     color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:    { label: 'Refusé',                        color: 'bg-red-50 text-red-700 border-red-200' },
};

export default function ReturnRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orderId = params?.id as string;

  const [existing, setExisting] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch(`/api/orders/${orderId}/return`)
      .then((r) => r.json())
      .then((d) => { setExisting(d.return_request); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, orderId, router]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploads = await Promise.all(
        Array.from(files).map(async (file) => {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch('/api/upload', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload échoué');
          return data.url as string;
        })
      );
      setPhotos((prev) => [...prev, ...uploads]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!reason) { setError('Veuillez sélectionner un motif'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description, photos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création');
        return;
      }
      setExisting(data.return_request);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href={`/account/orders/${orderId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary font-medium mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour à la commande
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-700 flex items-center justify-center shadow-lg shadow-primary/30">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Demande de retour</h1>
              <p className="text-sm text-slate-500">Commande #{orderId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </motion.div>

        {existing ? (
          <div className="bg-white rounded-3xl shadow-md border border-slate-100 p-8">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_LABELS[existing.status]?.color || 'bg-slate-50 text-slate-700 border-slate-200'} mb-6`}>
              <Clock className="w-3.5 h-3.5" />
              {STATUS_LABELS[existing.status]?.label || existing.status}
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">N° RMA</p>
                <p className="text-sm font-mono font-bold text-slate-900 mt-1">{existing.rma_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Date demande</p>
                <p className="text-sm text-slate-900 mt-1">
                  {new Date(existing.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Motif</p>
              <p className="text-sm text-slate-800">{REASONS.find(r => r.value === existing.reason)?.label}</p>
            </div>

            {existing.description && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{existing.description}</p>
              </div>
            )}

            {existing.status === 'rejected' && existing.rejection_reason && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <p className="font-semibold mb-1">Motif du refus</p>
                <p>{existing.rejection_reason}</p>
              </div>
            )}

            {existing.status === 'refunded' && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Remboursement effectué</p>
                  <p>Le montant de {existing.refund_amount ? `${parseFloat(existing.refund_amount).toFixed(2)} €` : ''} a été remboursé sur votre carte. Il apparaît sous 5 à 10 jours ouvrés.</p>
                </div>
              </div>
            )}

            {existing.return_tracking_number && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
                <p className="font-semibold mb-1">Étiquette retour</p>
                <p>Suivi : <span className="font-mono">{existing.return_tracking_number}</span></p>
              </div>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl shadow-md border border-slate-100 p-8">
            <div className="flex items-start gap-3 p-4 mb-6 bg-amber-50 border border-amber-100 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">Conditions de remboursement</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                  <li>14 jours après réception pour une rétractation, 30 jours pour un défaut</li>
                  <li>Téléphone <strong>réinitialisé en usine</strong> et compte iCloud / Google déconnecté</li>
                  <li>IMEI identique à celui expédié (vérifié à réception)</li>
                  <li>État conforme à l'envoi — toute dégradation peut entraîner un refus ou un remboursement partiel</li>
                </ul>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-800 mb-3">Motif du retour *</label>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label key={r.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    reason === r.value ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio" name="reason" value={r.value}
                      checked={reason === r.value} onChange={(e) => setReason(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                      {r.hint && <p className="text-xs text-slate-500 mt-0.5">{r.hint}</p>}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Description (optionnel)</label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                rows={4} maxLength={500}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Décrivez le problème en détail (ne pas inclure d'informations personnelles)"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Photos (optionnel mais recommandé)</label>
              <div className="grid grid-cols-4 gap-3">
                {photos.map((url, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-slate-200" />
                    <button
                      onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                      type="button"
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-md p-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/40 hover:bg-slate-50 transition">
                  <ImagePlus className="w-5 h-5 text-slate-400" />
                  <span className="text-xs text-slate-500">{uploading ? 'Upload…' : 'Ajouter'}</span>
                  <input
                    type="file" accept="image/*" multiple
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={submit} disabled={!reason || submitting || uploading}
              className="w-full bg-primary text-white py-4 rounded-2xl font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Envoi…' : 'Envoyer la demande de retour'}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
