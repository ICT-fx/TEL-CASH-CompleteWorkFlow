import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/orders/test-order — crée une commande FICTIVE (démo livraison).
// Client fictif + un iPhone en stock + adresse FR. Sert à tester le bordereau
// Boxtal sans passer par le tunnel de vente. Réservé admin.
export async function POST() {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const supabase = createAdminClient();

    // Un iPhone en stock pour la ligne de commande.
    const { data: phone } = await supabase
      .from('products')
      .select('id, brand, model, price, sku, storage_capacity')
      .eq('brand', 'Apple')
      .ilike('model', '%iPhone%')
      .gt('stock', 0)
      .order('stock', { ascending: false })
      .limit(1)
      .single();

    const price = phone ? Number(phone.price) || 299 : 299;

    const shippingAddress = {
      firstName: 'Client',
      lastName: 'Test',
      address: '10 rue Saint-Étienne',
      zipCode: '49100',
      city: 'Angers',
      country: 'France',
      phone: '+33600000000',
      email: 'client.test@telandcash.fr',
    };

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: profile!.id, // rattachée à l'admin (commande de test)
        total_amount: price,
        status: 'paid',
        fulfillment_status: 'unfulfilled',
        shipping_method: 'chronopost_domicile',
        shipping_address: shippingAddress,
        discount_amount: 0,
        notes: 'Commande de TEST (démo livraison Boxtal) — créée depuis l\'admin.',
      })
      .select()
      .single();

    if (error || !order) {
      return NextResponse.json({ error: error?.message || 'Création impossible' }, { status: 500 });
    }

    if (phone) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: phone.id,
        quantity: 1,
        price_at_purchase: price,
        product_name: [phone.brand, phone.model, phone.storage_capacity].filter(Boolean).join(' '),
        product_sku: phone.sku || null,
      });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
