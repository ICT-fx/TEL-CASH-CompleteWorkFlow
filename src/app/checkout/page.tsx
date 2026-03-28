'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function CheckoutPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [shippingMethod, setShippingMethod] = useState('mondial_relay');
  const [referralCode, setReferralCode] = useState('');
  const [codeStatus, setCodeStatus] = useState('');
  const [discount, setDiscount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  const shippingCosts: Record<string, number> = {
    mondial_relay: 4.99,
    chronopost_domicile: 8.99,
    chronopost_relay: 6.99,
  };

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch('/api/cart')
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0); });
  }, [user]);

  const validateCode = async () => {
    const res = await fetch('/api/referral/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: referralCode }),
    });
    const data = await res.json();
    if (data.valid) {
      const disc = data.discount_type === 'fixed' ? data.discount_value : total * (data.discount_value / 100);
      setDiscount(parseFloat(disc));
      setCodeStatus(`✅ -${parseFloat(data.discount_value).toFixed(2)}${data.discount_type === 'percent' ? '%' : '€'}`);
    } else {
      setCodeStatus(`❌ ${data.error}`);
      setDiscount(0);
    }
  };

  const handleCheckout = async () => {
    setProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_method: shippingMethod,
          referral_code: referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        setError(data.error || 'Erreur lors du checkout');
        setProcessing(false);
      }
    } catch {
      setError('Erreur réseau');
      setProcessing(false);
    }
  };

  const shipping = shippingCosts[shippingMethod] || 0;
  const grandTotal = total + shipping - discount;

  return (
    <div className="page">
      <div className="container">
        <h1>Checkout</h1>
        {items.length === 0 ? (
          <p>Votre panier est vide.</p>
        ) : (
          <div className="two-col">
            <div>
              <div className="card">
                <h2>Récapitulatif</h2>
                {items.map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{item.product?.brand} {item.product?.model} × {item.quantity}</span>
                    <span>{(parseFloat(item.product?.price) * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <h2>Livraison</h2>
                {Object.entries(shippingCosts).map(([key, cost]) => (
                  <label key={key} style={{ display: 'block', padding: '8px 0', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="shipping"
                      value={key}
                      checked={shippingMethod === key}
                      onChange={() => setShippingMethod(key)}
                    />{' '}
                    {key.replace(/_/g, ' ')} — {cost.toFixed(2)} €
                  </label>
                ))}
              </div>

              <div className="card">
                <h2>Code promo / Parrainage</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value)}
                    placeholder="Entrez un code"
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                  />
                  <button onClick={validateCode} className="btn btn-outline btn-sm">Appliquer</button>
                </div>
                {codeStatus && <p style={{ marginTop: 8, fontSize: '0.9rem' }}>{codeStatus}</p>}
              </div>
            </div>

            <div>
              <div className="card">
                <h2>Total</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sous-total</span><span>{total.toFixed(2)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Livraison</span><span>{shipping.toFixed(2)} €</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                    <span>Réduction</span><span>-{discount.toFixed(2)} €</span>
                  </div>
                )}
                <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: 700 }}>
                  <span>Total</span><span>{grandTotal.toFixed(2)} €</span>
                </div>

                {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

                <button
                  onClick={handleCheckout}
                  disabled={processing}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 16, padding: 14, fontSize: '1rem' }}
                >
                  {processing ? 'Redirection vers Stripe...' : '💳 Payer maintenant'}
                </button>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 8, textAlign: 'center' }}>
                  Paiement sécurisé par Stripe
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
