import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { fetchAll } from '@/lib/admin/sales';

// GET /api/admin/search?q=… — recherche rapide du back-office (Ctrl K).
// Commandes (par numéro, nom ou e-mail du client), clients, produits.
// Lecture seule, 5 résultats max par type.

export interface SearchHit { type: 'order' | 'client' | 'product'; title: string; sub: string; href: string }

// Échappe les caractères spéciaux d'un motif ILIKE et ceux du filtre `or` de PostgREST.
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')}%`;
const eur = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} €`;

export async function GET(request: Request) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ hits: [] });
    const db = createAdminClient();
    const pat = like(q);
    const hits: SearchHit[] = [];

    // Clients (profils) qui correspondent : servent aussi à trouver leurs commandes.
    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name, email')
      .or(`full_name.ilike.${pat},email.ilike.${pat}`)
      .limit(5);

    // Commandes : numéro lisible (n°…) ou client trouvé ci-dessus.
    // Le n° est le rang chronologique (lib/orderNumber) : on ne charge toutes les
    // dates que si on cherche un numéro.
    const num = /^n?°?\s*#?(\d{1,6})$/i.exec(q)?.[1];
    const orderIds: string[] = [];
    if (num) {
      const refs = await fetchAll<{ id: string; created_at: string }>((from, to) =>
        db.from('orders').select('id, created_at').range(from, to));
      for (const [id, n] of buildOrderNumberMap(refs)) if (n === Number(num)) orderIds.push(id);
    }
    const profileIds = (profiles ?? []).map((p) => p.id);
    const ors: string[] = [`guest_email.ilike.${pat}`];
    if (profileIds.length) ors.push(`user_id.in.(${profileIds.join(',')})`);
    if (orderIds.length) ors.push(`id.in.(${orderIds.join(',')})`);
    // Produits : on écarte en base les lignes miroir du flux fournisseur (source = 'fluxitron').
    const notMirror = 'or(source.is.null,source.neq.fluxitron)';
    const [{ data: orders }, { data: products }] = await Promise.all([
      db.from('orders')
        .select('id, status, total_amount, created_at, guest_email, profile:profiles(full_name, email)')
        .not('status', 'in', '(pending,awaiting_payment,failed)')
        .or(ors.join(','))
        .order('created_at', { ascending: false })
        .limit(5),
      db.from('products')
        .select('id, brand, model, storage_capacity, grade, price, stock')
        .or(`and(model.ilike.${pat},${notMirror}),and(brand.ilike.${pat},${notMirror})`)
        .order('is_active', { ascending: false })
        .limit(5),
    ]);

    // N° lisible des commandes trouvées : nombre de commandes créées avant, + 1.
    const numbers = new Map<string, number>();
    await Promise.all((orders ?? []).map(async (o) => {
      const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).lt('created_at', o.created_at);
      if (count != null) numbers.set(o.id, count + 1);
    }));

    for (const o of orders ?? []) {
      const raw = (o as { profile: unknown }).profile;
      const p = (Array.isArray(raw) ? raw[0] : raw) as { full_name?: string | null; email?: string | null } | null;
      const n = numbers.get(o.id);
      hits.push({
        type: 'order',
        title: `Commande${n ? ` n°${n}` : ''} · ${p?.full_name || p?.email || o.guest_email || 'Client'}`,
        sub: `${eur(o.total_amount)} · ${new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
        href: `/admin/orders/${o.id}`,
      });
    }
    for (const p of profiles ?? []) {
      hits.push({ type: 'client', title: p.full_name || p.email || 'Client', sub: p.full_name && p.email ? p.email : 'Fiche client', href: `/admin/clients/${p.id}` });
    }
    for (const p of products ?? []) {
      hits.push({
        type: 'product',
        title: [p.brand, p.model, p.storage_capacity].filter(Boolean).join(' '),
        sub: [p.grade ? `grade ${p.grade}` : null, p.price != null ? eur(p.price) : null, `${p.stock ?? 0} en stock`].filter(Boolean).join(' · '),
        href: `/admin/products/${p.id}`,
      });
    }
    return NextResponse.json({ hits });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
