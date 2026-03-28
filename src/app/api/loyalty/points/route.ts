import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

// GET /api/loyalty/points — Get user's loyalty points balance and history
export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();

    const { data: transactions, error } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const totalPoints = transactions?.reduce((sum, t) => sum + t.points, 0) || 0;

    return NextResponse.json({
      totalPoints,
      transactions: transactions || [],
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
