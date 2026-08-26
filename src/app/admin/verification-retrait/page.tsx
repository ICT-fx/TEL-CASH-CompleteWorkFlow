'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PackageCheck, QrCode, ChevronRight, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { useToast } from '@/components/admin/ui/Toast';

interface OrderItem {
  quantity: number;
  price: string;
  name: string;
  details: string;
  image: string | null;
}

interface VerifyResult {
  valid: boolean;
  alreadyUsed?: boolean;
  message: string;
  orderId?: string;
  orderNumber?: number | null;
  status?: string;
  customerName?: string;
  total?: string;
  items?: OrderItem[];
}

// Page dédiée comptoir : l'employé n'a qu'un code (pas d'id de commande) —
// contrairement au bloc équivalent dans /admin/orders/[id], qui suppose la
// commande déjà ouverte. Consomme POST /api/admin/orders/verify-pickup-code
// (recherche par code), sœur de [id]/verify-pickup-code (recherche par id).
export default function VerificationRetraitPage() {
  const { showToast, toastElement } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [marking, setMarking] = useState(false);
  const [markedDone, setMarkedDone] = useState(false);

  const verify = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setMarkedDone(false);
    try {
      const res = await fetch('/api/admin/orders/verify-pickup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ valid: false, message: data.error || 'Erreur' });
        return;
      }
      setResult(data);
    } catch {
      setResult({ valid: false, message: 'Erreur réseau' });
    } finally {
      setLoading(false);
    }
  };

  const markDelivered = async () => {
    if (!result?.orderId) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/admin/orders/${result.orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      });
      if (!res.ok) {
        showToast('Erreur lors du marquage.');
        return;
      }
      setMarkedDone(true);
      showToast('Commande marquée comme retirée.');
    } catch {
      showToast('Erreur réseau.');
    } finally {
      setMarking(false);
    }
  };

  const reset = () => {
    setCode('');
    setResult(null);
    setMarkedDone(false);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {toastElement}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 9 }}>
          <QrCode className="w-5 h-5" style={{ color: '#1d4ed8' }} />
          Vérification retrait
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 6 }}>
          Le client vous montre le code reçu par email (texte ou QR) — saisissez-le ici, ou scannez-le
          avec une douchette. La commande s'affiche automatiquement si le code est valide. Un code déjà
          utilisé, expiré ou saisi 5 fois de suite de travers est bloqué automatiquement.
        </p>
      </div>

      <div className="admin-ui-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value); setResult(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
            placeholder="Ex: 7K4M-QW2X"
            className="admin-form-input"
            style={{ flex: 1, minWidth: 200, fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '1.05rem', padding: '10px 14px' }}
          />
          <button
            className="admin-btn-primary"
            disabled={loading || !code.trim()}
            onClick={verify}
            style={{ padding: '10px 20px' }}
          >
            {loading ? 'Vérification…' : 'Vérifier'}
          </button>
        </div>
      </div>

      {result && !result.valid && (
        <div style={{
          marginTop: 16, padding: 14, borderRadius: 10, fontSize: '0.9rem', fontWeight: 500,
          background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ❌ {result.message}
        </div>
      )}

      {result?.valid && (
        <div className="admin-ui-card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: '0.88rem', fontWeight: 600, marginBottom: 16 }}>
            <ShieldCheck className="w-4 h-4" /> Code valide
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Avatar name={result.customerName} size={42} />
              <div>
                <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.92rem' }}>{result.customerName}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Commande {result.orderNumber != null ? `n°${result.orderNumber}` : '—'}
                </div>
              </div>
            </div>
            {result.orderId && (
              <Link
                href={`/admin/orders/${result.orderId}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.8rem', color: '#1d4ed8', textDecoration: 'none', fontWeight: 500 }}
              >
                Voir la commande <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div style={{ borderTop: '0.5px solid #e2e8f0', paddingTop: 14 }}>
            {(result.items || []).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                <img
                  src={item.image || 'https://placehold.co/64x64/f8fafc/cbd5e1?text=📱'}
                  alt={item.name}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '0.5px solid #e2e8f0', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.87rem' }}>{item.name}</div>
                  {item.details && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{item.details}</div>}
                  <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 2 }}>Quantité : {item.quantity}</div>
                </div>
                <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.87rem', flexShrink: 0 }}>
                  {parseFloat(item.price || '0').toFixed(2)} €
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '0.5px solid #e2e8f0', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>Total</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>{parseFloat(result.total || '0').toFixed(2)} €</span>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            {markedDone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontSize: '0.85rem', fontWeight: 500 }}>
                <PackageCheck className="w-4 h-4" /> Commande marquée comme retirée
              </div>
            ) : result.status === 'shipped' ? (
              <button className="admin-btn-primary" disabled={marking} onClick={markDelivered}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PackageCheck className="w-4 h-4" /> {marking ? 'Confirmation…' : 'Marquer comme retirée'}
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Cette commande n'a pas encore été marquée « prête à retirer » — ouvrez-la pour la préparer avant remise.
              </div>
            )}
            <button className="admin-btn admin-btn-ghost" onClick={reset}>Nouvelle vérification</button>
          </div>
        </div>
      )}
    </div>
  );
}
