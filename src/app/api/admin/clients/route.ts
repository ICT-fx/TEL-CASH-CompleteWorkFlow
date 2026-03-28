import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/clients — List all customers with order counts
export async function GET(request: Request) {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: clients, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get order counts for each client
    const clientIds = (clients || []).map(c => c.id);
    const enrichedClients = [];

    for (const client of (clients || [])) {
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', client.id);

      const { data: totalData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', client.id)
        .in('status', ['paid', 'shipped', 'delivered']);

      const totalSpent = totalData?.reduce(
        (sum, o) => sum + parseFloat(o.total_amount as unknown as string), 0
      ) || 0;

      enrichedClients.push({
        ...client,
        order_count: orderCount || 0,
        total_spent: totalSpent,
      });
    }

    return NextResponse.json({
      clients: enrichedClients,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
