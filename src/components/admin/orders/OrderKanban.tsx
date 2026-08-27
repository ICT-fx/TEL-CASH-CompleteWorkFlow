'use client';

// Tableau façon Trello pour changer le statut d'une commande par glisser-
// déposer. Volontairement limité aux 4 statuts "actifs" du pipeline —
// annulée/remboursée restent gérées depuis le détail commande (remboursement
// réel à traiter, pas un simple changement d'étiquette).
//
// Deux statuts ne sont JAMAIS appliqués directement par un drop : "Prête/
// Expédiée" et "Retirée/Livrée" côté retrait ont des garde-fous qui ne
// doivent pas être contournables d'un glisser-déposer :
//  - Prête/Expédiée : capture IMEI+photos (expédition) ou case de
//    confirmation obligatoire (retrait) — cf. ShipModal. Le drop renvoie
//    vers le détail commande, modale déjà ouverte.
//  - Retirée/Livrée en retrait boutique : bloqué tant que le code de retrait
//    n'a pas été vérifié en boutique (pickup_code_verified_at).

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Store, Truck } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { useToast } from '@/components/admin/ui/Toast';

export interface KanbanOrder {
  id: string;
  status: string;
  total_amount: string;
  delivery_method: string | null;
  order_number: number | null;
  pickup_code_verified_at?: string | null;
  profile?: { email?: string | null; full_name?: string | null } | null;
}

const COLUMNS: { key: string; label: string }[] = [
  { key: 'paid', label: 'Payée' },
  { key: 'supplier_ordered', label: 'Commande fournisseur' },
  { key: 'shipped', label: 'Prête / Expédiée' },
  { key: 'delivered', label: 'Retirée / Livrée' },
];

export function OrderKanban({ orders, onChanged }: { orders: KanbanOrder[]; onChanged: () => void }) {
  const router = useRouter();
  const { showToast, toastElement } = useToast();
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const byColumn = (key: string) => orders.filter((o) => o.status === key);

  const applyStatus = async (orderId: string, status: string) => {
    setMovingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      showToast('La mise à jour a échoué');
    } finally {
      setMovingId(null);
    }
  };

  const handleDrop = (columnKey: string, orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === columnKey) return;
    const isPickup = order.delivery_method === 'pickup';

    if (columnKey === 'shipped') {
      // Toujours passer par la modale (IMEI+photos ou case de confirmation
      // retrait) — jamais de changement de statut direct depuis le tableau.
      router.push(`/admin/orders/${order.id}?openShip=1`);
      return;
    }
    if (columnKey === 'delivered' && isPickup && !order.pickup_code_verified_at) {
      showToast('Code de retrait non vérifié — passe par « Vérification retrait » avant de marquer comme retirée');
      return;
    }
    applyStatus(order.id, columnKey);
  };

  return (
    <div>
      {toastElement}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))',
          gap: 14,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {COLUMNS.map((col) => {
          const items = byColumn(col.key);
          const isOver = dragOverCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol(null);
                const orderId = e.dataTransfer.getData('text/plain');
                if (orderId) handleDrop(col.key, orderId);
              }}
              style={{
                background: isOver ? '#EEF3FF' : '#F4F6F9',
                border: isOver ? '1.5px dashed #2F6BFF' : '1.5px dashed transparent',
                borderRadius: 14,
                padding: 10,
                minHeight: 200,
                transition: 'background .12s ease, border-color .12s ease',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 6px 10px',
              }}>
                <span style={{ font: '600 12.5px Inter, sans-serif', color: '#374151' }}>{col.label}</span>
                <span style={{
                  font: '700 11px Inter, sans-serif', color: '#6B7280',
                  background: '#E5E9F0', borderRadius: 999, padding: '1px 7px',
                }}>
                  {items.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', o.id)}
                    onClick={() => router.push(`/admin/orders/${o.id}`)}
                    style={{
                      background: '#fff',
                      borderRadius: 10,
                      padding: '10px 12px',
                      boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 2px 8px rgba(16,24,40,.04)',
                      cursor: movingId === o.id ? 'wait' : 'grab',
                      opacity: movingId === o.id ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={o.profile?.full_name} email={o.profile?.email} size={24} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          font: '600 12px Inter, sans-serif', color: '#111827',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {o.profile?.full_name || o.profile?.email || 'Client'}
                        </div>
                        <div style={{ font: '400 11px Inter, sans-serif', color: '#9CA3AF' }}>
                          {o.order_number != null ? `n°${o.order_number}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginTop: 8,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 10.5px Inter, sans-serif', color: '#9CA3AF' }}>
                        {o.delivery_method === 'pickup' ? <Store className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
                        {o.delivery_method === 'pickup' ? 'Retrait' : 'Domicile'}
                      </span>
                      <span style={{ font: '700 12px Inter, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                        {parseFloat(o.total_amount).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ font: '400 11.5px Inter, sans-serif', color: '#9CA3AF', padding: '8px 6px' }}>
                    Aucune commande
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
