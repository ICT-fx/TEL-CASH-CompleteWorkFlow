'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoyaltyPage() {
  const [totalPoints, setTotalPoints] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    fetch('/api/loyalty/points')
      .then(r => r.json())
      .then(d => { setTotalPoints(d.totalPoints || 0); setTransactions(d.transactions || []); });
    fetch('/api/referral/my-code')
      .then(r => r.json())
      .then(d => setReferralCode(d.referralCode));
  }, [user]);

  const generateCode = async () => {
    setGenerating(true);
    const res = await fetch('/api/referral/generate', { method: 'POST' });
    const data = await res.json();
    setReferralCode(data.referralCode);
    setGenerating(false);
  };

  return (
    <div className="page">
      <div className="container">
        <Link href="/account">← Mon compte</Link>
        <h1 style={{ marginTop: 12 }}>Fidélité &amp; Parrainage</h1>

        <div className="two-col">
          <div>
            <div className="card" style={{ textAlign: 'center' }}>
              <h2>Mes points fidélité</h2>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--primary)' }}>{totalPoints}</div>
              <p className="text-muted">points accumulés</p>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
                1 point = 1€ dépensé
              </p>
            </div>

            {transactions.length > 0 && (
              <div className="card">
                <h2>Historique des points</h2>
                <table>
                  <thead>
                    <tr><th>Date</th><th>Raison</th><th>Points</th></tr>
                  </thead>
                  <tbody>
                    {transactions.map((t: any) => (
                      <tr key={t.id}>
                        <td>{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                        <td>{t.reason}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="card">
              <h2>Mon code parrainage</h2>
              {referralCode ? (
                <>
                  <div style={{
                    background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius)',
                    textAlign: 'center', fontFamily: 'monospace', fontSize: '1.5rem',
                    fontWeight: 700, letterSpacing: 2, marginBottom: 12
                  }}>
                    {referralCode.code}
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Réduction : {parseFloat(referralCode.discount_value).toFixed(2)}{referralCode.discount_type === 'percent' ? '%' : '€'}
                  </p>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Utilisé : {referralCode.times_used}/{referralCode.max_uses} fois
                  </p>
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
                    Partagez ce code avec vos amis pour leur offrir une réduction !
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p className="text-muted mb-2">Vous n&apos;avez pas encore de code parrainage.</p>
                  <button onClick={generateCode} disabled={generating} className="btn btn-primary">
                    {generating ? 'Génération...' : 'Générer mon code'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
