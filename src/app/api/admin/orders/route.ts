import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/orders — List all orders
export async function GET(request: Request) {
  try {
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    let query = supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      if (status === 'active') {
        query = query.in('status', ['paid', 'shipped', 'delivered']);
      } else if (status !== 'all') {
        query = query.eq('status', status);
      }
    }

    const { data: orders, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      orders,
      pagination: { page, limit, total: count || 0 },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
