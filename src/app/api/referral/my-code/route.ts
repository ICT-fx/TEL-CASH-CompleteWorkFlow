import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

// GET /api/referral/my-code — Get current user's referral code
export async function GET() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();

    const { data: code } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', user!.id)
      .single();

    return NextResponse.json({ referralCode: code || null });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
