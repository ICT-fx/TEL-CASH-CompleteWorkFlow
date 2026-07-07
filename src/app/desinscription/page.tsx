import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Désinscription RGPD des relances. Le jeton (unsubscribe_token) fait foi :
// aucune authentification requise. Idempotent.
export default async function DesinscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;

  if (token) {
    const db = createAdminClient();
    const { error, count } = await db
      .from('profiles')
      .update({ marketing_opt_out: true }, { count: 'exact' })
      .eq('unsubscribe_token', token);
    ok = !error && (count ?? 0) > 0;
  }

  return (
    <main style={{ maxWidth: 520, margin: '80px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0B1437' }}>TEL &amp; CASH</h1>
      {ok ? (
        <p style={{ color: '#1B6E3B', fontSize: 15, lineHeight: 1.6, marginTop: 16 }}>
          C'est fait ✅ — vous ne recevrez plus nos emails de relance. Vous pouvez continuer à
          passer commande normalement.
        </p>
      ) : (
        <p style={{ color: '#B4232A', fontSize: 15, lineHeight: 1.6, marginTop: 16 }}>
          Lien de désinscription invalide ou expiré. Écrivez-nous à infos@telandcash.fr et nous
          nous en occupons.
        </p>
      )}
    </main>
  );
}
