import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/disputes — liste des litiges Stripe (lecture seule)
export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const supabase = createAdminClient();
    let query = supabase
      .from('disputes')
      .select(
        '*, order:orders(id, order_number, total_amount, status, profile:profiles(email, full_name))'
      )
      .order('created_at', { ascending: false });

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ disputes: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
