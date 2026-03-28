import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requireAuth } from '@/lib/auth';

// POST /api/referral/generate — Generate a referral code for current user
export async function POST() {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const supabase = await createServerSupabaseClient();

    // Check if user already has a code
    const { data: existing } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', user!.id)
      .single();

    if (existing) {
      return NextResponse.json({ referralCode: existing });
    }

    // Generate unique code: TC-XXXXX
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `TC-${randomPart}`;

    const { data: referralCode, error } = await supabase
      .from('referral_codes')
      .insert({
        user_id: user!.id,
        code,
        discount_value: 10.00,
        discount_type: 'fixed',
        max_uses: 5,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ referralCode }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
