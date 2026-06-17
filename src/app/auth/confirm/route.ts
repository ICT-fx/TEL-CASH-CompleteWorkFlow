import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// Cible des liens email Supabase (réinitialisation de mot de passe, etc.).
// Avec @supabase/ssr, le jeton du lien doit être échangé côté serveur contre
// une session, sinon la page de destination n'a aucune session active.
// On gère les deux variantes possibles :
//   - token_hash + type  → verifyOtp (recommandé, fonctionne même si le lien
//     est ouvert sur un autre appareil que celui de la demande)
//   - code               → exchangeCodeForSession (flux PKCE par défaut)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  // Pas d'open redirect : seuls les chemins internes sont acceptés.
  const rawNext = searchParams.get('next') ?? '/';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createServerSupabaseClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Jeton manquant ou expiré → on renvoie vers la demande de réinitialisation.
  return NextResponse.redirect(new URL('/auth/forgot-password?error=lien_invalide', origin));
}
