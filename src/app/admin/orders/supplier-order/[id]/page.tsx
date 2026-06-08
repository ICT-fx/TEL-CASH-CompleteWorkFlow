'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Printer, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

interface SupplierOrderLine {
  sku: string | null;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  grade: string | null;
  qty: number;
}

interface SupplierOrder {
  id: string;
  po_number: number;
  lines: SupplierOrderLine[];
  total_units: number;
  created_at: string;
  status: 'draft' | 'confirmed';
  approved_at: string | null;
}

// Company details printed on the purchase order (English document for Foxway).
const COMPANY = {
  tradeName: 'Trade name: Tel and Cash',
  legal: 'PC ANGERS — French limited company (EURL), share capital €10,000',
  registry: 'Angers Trade & Companies Register (RCS): 985 009 695',
  vat: 'Intra-EU VAT: FR48985009695',
  address: '10 rue Saint-Étienne, 49100 Angers, France',
  phone: 'Phone: +33 2 85 35 95 32',
  email: 'Email: contact@telandcash.fr',
};

export default function SupplierOrderPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<SupplierOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/orders/supplier-order/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        setPo(data.supplierOrder);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const approve = async () => {
    setApproving(true);
    setApproveError(null);
    try {
      const res = await fetch(`/api/admin/orders/supplier-order/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'approbation");
      setPo((prev) => prev ? { ...prev, status: 'confirmed', approved_at: new Date().toISOString() } : prev);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-empty">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  if (error || !po) {
    return <div className="admin-empty">{error || 'Bon introuvable'}</div>;
  }

  // English document date (e.g. "08 Jun 2026").
  const dateEn = new Date(po.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const isConfirmed = po.status === 'confirmed';

  return (
    <>
      {/* Impression : masque tout le chrome admin, ne garde que le bon. */}
      <style>{`
        @media print {
          .admin-sidebar, .admin-topbar, .admin-mobile-toggle, .supplier-po-actions, .supplier-po-banner { display: none !important; }
          .admin-main, .admin-main.expanded { margin-left: 0 !important; }
          .admin-content { padding: 0 !important; }
          .supplier-po { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: 100% !important; }
          @page { margin: 18mm; }
        }
      `}</style>

      {/* Barre d'actions (non imprimée) */}
      <div className="supplier-po-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <Link href="/admin/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.88rem' }}>
          <ArrowLeft className="w-4 h-4" /> Retour aux commandes
        </Link>
        <button
          onClick={() => window.print()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}
        >
          <Printer className="w-4 h-4" /> Imprimer / PDF
        </button>
      </div>

      {/* Bandeau d'approbation (non imprimé) */}
      <div
        className="supplier-po-banner"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          marginBottom: 18, padding: '14px 18px', borderRadius: 10,
          background: isConfirmed ? '#ecfdf5' : '#fffbeb',
          border: `0.5px solid ${isConfirmed ? '#a7f3d0' : '#fde68a'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isConfirmed ? (
            <CheckCircle2 className="w-5 h-5" style={{ color: '#15803d', flexShrink: 0 }} />
          ) : (
            <Clock className="w-5 h-5" style={{ color: '#b45309', flexShrink: 0 }} />
          )}
          <div style={{ fontSize: '0.86rem', color: '#0f172a' }}>
            {isConfirmed ? (
              <>
                <strong>Commande fournisseur approuvée.</strong> Les commandes liées sont passées au statut « Commande fournisseur ».
                {po.approved_at && (
                  <span style={{ color: '#64748b' }}>{' '}· {new Date(po.approved_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </>
            ) : (
              <>
                <strong>En attente d&apos;approbation.</strong> Les commandes restent « Payées » tant que tu n&apos;as pas validé ce bon.
              </>
            )}
          </div>
        </div>
        {!isConfirmed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={approve}
              disabled={approving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#15803d', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: '0.88rem', fontWeight: 500, cursor: approving ? 'wait' : 'pointer' }}
            >
              {approving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Approbation…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Approuver et passer en Commande fournisseur
                </>
              )}
            </button>
            {approveError && (
              <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{approveError}</span>
            )}
          </div>
        )}
      </div>

      <div
        className="supplier-po"
        style={{
          background: 'white', maxWidth: 820, margin: '0 auto',
          border: '0.5px solid #e2e8f0', borderRadius: 12, padding: 40,
          color: '#0f172a',
        }}
      >
        {/* Header: logo + PO number */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 28 }}>
          <Image src="/logo-telcash.png" alt="TEL & CASH" width={170} height={56} style={{ objectFit: 'contain', height: 'auto' }} priority />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.02em' }}>
              PURCHASE ORDER #{po.po_number}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 4 }}>
              Date: {dateEn}
            </div>
          </div>
        </div>

        {/* Buyer details */}
        <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.7, marginBottom: 28, borderBottom: '0.5px solid #e2e8f0', paddingBottom: 20 }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Buyer</div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{COMPANY.tradeName}</div>
          <div>{COMPANY.legal}</div>
          <div>{COMPANY.registry} · {COMPANY.vat}</div>
          <div>{COMPANY.address}</div>
          <div>{COMPANY.phone} · {COMPANY.email}</div>
        </div>

        {/* Line items — only what's needed to order from Foxway: SKU + Qty */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 8px', fontWeight: 500 }}>Foxway SKU</th>
              <th style={{ padding: '10px 8px', fontWeight: 500 }}>Description</th>
              <th style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l, i) => {
              const description = [
                [l.brand, l.model].filter(Boolean).join(' '),
                l.storage,
                l.color,
                l.grade ? `Grade ${l.grade}` : null,
              ].filter(Boolean).join(' · ');
              return (
                <tr key={i} style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#0f766e', whiteSpace: 'nowrap' }}>
                    {l.sku || '—'}
                  </td>
                  <td style={{ padding: '12px 8px', color: '#475569' }}>
                    {description || '—'}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>{l.qty}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.95rem' }}>
            <span style={{ color: '#64748b' }}>Total units to order: </span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{po.total_units}</span>
          </div>
        </div>
      </div>
    </>
  );
}
