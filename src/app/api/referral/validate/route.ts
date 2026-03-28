import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// POST /api/referral/validate — Validate a referral code
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: referralCode, error } = await supabase
      .from('referral_codes')
      .select('code, discount_value, discount_type, is_active, times_used, max_uses')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !referralCode) {
      return NextResponse.json({ valid: false, error: 'Code introuvable' }, { status: 404 });
    }

    if (!referralCode.is_active || referralCode.times_used >= referralCode.max_uses) {
      return NextResponse.json({ valid: false, error: 'Code expiré ou déjà utilisé' }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      discount_value: referralCode.discount_value,
      discount_type: referralCode.discount_type,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
