import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// Une ligne agrégée du bon de commande fournisseur.
interface SupplierOrderLine {
  sku: string | null;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  grade: string | null;
  qty: number;
}

// Clé d'agrégation : le SKU fournisseur (FLX-…) identifie une référence unique.
// On ajoute les attributs en repli pour les produits sans SKU.
function lineKey(p: {
  sku?: string | null;
  brand?: string | null;
  model?: string | null;
  storage_capacity?: string | null;
  color?: string | null;
  grade?: string | null;
}): string {
  if (p.sku && p.sku.trim()) return `sku:${p.sku.trim().toLowerCase()}`;
  return [p.brand, p.model, p.storage_capacity, p.color, p.grade]
    .map((v) => (v ?? '').trim().toLowerCase())
    .join('|');
}

// POST /api/admin/orders/supplier-order
// Génère un bon de commande pour tous les produits des commandes encore au
// statut `paid`, enregistre le bon, puis bascule ces commandes en
// `supplier_ordered`. Action unique et idempotente : une fois basculées, les
// commandes ne ressortent plus au prochain appel.
export async function POST() {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    // 1. Commandes payées en attente de transmission fournisseur.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'paid');

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 400 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Aucune commande payée à transmettre au fournisseur.' },
        { status: 409 }
      );
    }

    const orderIds = orders.map((o) => o.id);

    // 2. Articles de ces commandes + détails produit.
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(
        'quantity, product:products(sku, brand, model, storage_capacity, color, grade)'
      )
      .in('order_id', orderIds);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 400 });
    }

    // 3. Agrégation par produit identique.
    interface ProductRow {
      sku?: string | null;
      brand?: string | null;
      model?: string | null;
      storage_capacity?: string | null;
      color?: string | null;
      grade?: string | null;
    }
    const map = new Map<string, SupplierOrderLine>();
    let totalUnits = 0;
    for (const item of (items || []) as Array<{ quantity?: number; product?: ProductRow | ProductRow[] | null }>) {
      // Supabase peut typer la relation comme tableau ; on normalise.
      const raw = item.product;
      const p: ProductRow | null = Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
      if (!p) continue;
      const qty = item.quantity ?? 1;
      totalUnits += qty;
      const key = lineKey(p);
      const existing = map.get(key);
      if (existing) {
        existing.qty += qty;
      } else {
        map.set(key, {
          sku: p.sku ?? null,
          brand: p.brand || '',
          model: p.model || '',
          storage: p.storage_capacity ?? null,
          color: p.color ?? null,
          grade: p.grade ?? null,
          qty,
        });
      }
    }

    const lines = Array.from(map.values()).sort(
      (a, b) =>
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model) ||
        (a.storage || '').localeCompare(b.storage || '')
    );

    // 4. Numéro de bon séquentiel lisible.
    const { data: last } = await supabase
      .from('supplier_orders')
      .select('po_number')
      .order('po_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const poNumber = (last?.po_number ?? 0) + 1;

    // 5. Enregistrement du bon en `draft`. On NE bascule PAS les statuts ici :
    // les commandes restent `paid` jusqu'à l'approbation explicite de l'admin
    // (voir /supplier-order/[id]/approve).
    const { data: po, error: insertError } = await supabase
      .from('supplier_orders')
      .insert({
        po_number: poNumber,
        lines,
        order_ids: orderIds,
        total_units: totalUnits,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertError || !po) {
      return NextResponse.json(
        { error: insertError?.message || 'Échec de la création du bon.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: po.id,
      po_number: poNumber,
      order_count: orderIds.length,
      total_units: totalUnits,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// GET /api/admin/orders/supplier-order — compteur des commandes payées en
// attente (pour activer/désactiver le bouton dans la liste).
export async function GET() {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ pending_paid: count || 0 });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
