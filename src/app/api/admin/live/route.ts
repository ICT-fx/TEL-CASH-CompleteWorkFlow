import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { fetchAll, isCountedSale, loadSales } from '@/lib/admin/sales';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { countryPoint, lonLatOfZip, SHOP_LONLAT } from '@/lib/admin/geo';
import { pageLabel, sourceOf } from '@/lib/admin/live';
import { parisDayKey, parisHour } from '@/lib/admin/parisTime';

// GET /api/admin/live — écran « Activité » : qui est sur le site maintenant,
// ce qui s'est passé aujourd'hui, les colis en route. Lecture seule, rafraîchi
// toutes les 20 s par l'écran. Le suivi ne garde que le pays du visiteur
// (jamais l'adresse ni l'IP) : le globe place donc les visiteurs par pays.

export const dynamic = 'force-dynamic';

const MIN = 60_000;
const dayKey = parisDayKey;
const hourOf = parisHour;

export async function GET() {
  try {
    const { response } = await requireAdmin();
    if (response) return response;
    const db = createAdminClient();
    const now = new Date();
    const today = dayKey(now);
    const since36h = new Date(now.getTime() - 36 * 60 * MIN);
    const lastWeekDay = dayKey(new Date(now.getTime() - 7 * 24 * 60 * MIN));

    // ── Visites : aujourd'hui et le même jour la semaine dernière ─────────
    type PV = { created_at: string; visitor_id: string; session_id: string; path: string; referrer: string | null; device: string | null; country: string | null };
    let trackingReady = true;
    const pv = await fetchAll<PV>((from, to) => db
      .from('page_views')
      .select('created_at, visitor_id, session_id, path, referrer, device, country')
      .gte('created_at', since36h.toISOString())
      .order('created_at', { ascending: true })
      .range(from, to)).catch(() => { trackingReady = false; return [] as PV[]; });
    const lw0 = new Date(now.getTime() - 8 * 24 * 60 * MIN);
    const lw = await fetchAll<Pick<PV, 'created_at' | 'visitor_id'>>((from, to) => db
      .from('page_views')
      .select('created_at, visitor_id')
      .gte('created_at', lw0.toISOString())
      .lt('created_at', new Date(now.getTime() - 6 * 24 * 60 * MIN).toISOString())
      .order('created_at', { ascending: true })
      .range(from, to)).catch(() => [] as Pick<PV, 'created_at' | 'visitor_id'>[]);

    const todayPv = pv.filter((r) => dayKey(new Date(r.created_at)) === today);
    const visitsToday = new Set(todayPv.map((r) => r.visitor_id)).size;

    // Affluence : visiteurs distincts cumulés par heure (aujourd'hui vs il y a 7 jours).
    const cumul = (rows: { created_at: string; visitor_id: string }[], day: string) => {
      const seen = new Set<string>();
      const perHour = Array(24).fill(0) as number[];
      for (const r of rows) {
        const d = new Date(r.created_at);
        if (dayKey(d) !== day || seen.has(r.visitor_id)) continue;
        seen.add(r.visitor_id);
        perHour[hourOf(d)] += 1;
      }
      let acc = 0;
      return perHour.map((n) => (acc += n));
    };
    const nowHour = hourOf(now);
    const affluence = {
      today: cumul(todayPv, today).slice(0, nowHour + 1),
      lastWeek: cumul(lw, lastWeekDay),
    };

    // ── En ligne : vus dans les 5 dernières minutes ───────────────────────
    const onlineSince = now.getTime() - 5 * MIN;
    const byVisitor = new Map<string, PV[]>();
    for (const r of pv) byVisitor.set(r.visitor_id, [...(byVisitor.get(r.visitor_id) ?? []), r]);
    const online = Array.from(byVisitor.entries())
      .map(([id, rows]) => ({ id, rows, last: rows[rows.length - 1] }))
      .filter((v) => new Date(v.last.created_at).getTime() >= onlineSince)
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
    const visitors = online.slice(0, 15).map((v) => {
      const session = v.rows.filter((r) => r.session_id === v.last.session_id);
      const first = session[0] ?? v.last;
      const c = countryPoint(v.last.country);
      return {
        id: v.id.slice(-4),
        country: c?.name ?? 'Pays inconnu',
        countryCode: c?.code ?? null,
        device: v.last.device,
        page: pageLabel(v.last.path),
        pages: session.length,
        minutes: Math.max(0, Math.round((now.getTime() - new Date(first.created_at).getTime()) / MIN)),
        source: sourceOf(first.referrer),
        atCheckout: session.some((r) => r.path.startsWith('/checkout')),
        inCart: session.some((r) => r.path.startsWith('/cart')),
      };
    });
    const byCountry = new Map<string, { name: string; lonlat: [number, number] | null; n: number }>();
    for (const v of online) {
      const c = countryPoint(v.last.country);
      const key = c?.code ?? '??';
      const cur = byCountry.get(key) ?? { name: c?.name ?? 'Pays inconnu', lonlat: c?.lonlat ?? null, n: 0 };
      cur.n += 1;
      byCountry.set(key, cur);
    }

    // Pages regardées en ce moment (30 dernières minutes).
    const recent = pv.filter((r) => new Date(r.created_at).getTime() >= now.getTime() - 30 * MIN);
    const pageCount = new Map<string, number>();
    for (const r of recent) if (r.path.startsWith('/products/')) pageCount.set(r.path, (pageCount.get(r.path) ?? 0) + 1);
    const watched = Array.from(pageCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, n]) => ({ page: pageLabel(p), path: p, n }));

    // ── Ventes du jour ───────────────────────────────────────────────────
    const { orders: sales } = await loadSales(db, { since: since36h });
    const salesToday = sales.filter((o) => dayKey(o.createdAt) === today && isCountedSale(o));

    // ── Fil d'activité (36 h) et colis en route ───────────────────────────
    const [{ data: ords }, { data: rets }, refs] = await Promise.all([
      db.from('orders')
        .select('id, status, total_amount, created_at, updated_at, delivery_method, shipping_method, shipping_address, pickup_code_verified_at, profile:profiles(full_name)')
        .or(`created_at.gte.${since36h.toISOString()},and(status.eq.shipped,or(delivery_method.is.null,delivery_method.neq.pickup))`)
        .order('created_at', { ascending: false })
        .limit(200),
      db.from('return_requests').select('id, rma_number, status, created_at').gte('created_at', since36h.toISOString()),
      fetchAll<{ id: string; created_at: string }>((from, to) => db.from('orders').select('id, created_at').order('created_at').order('id').range(from, to)),
    ]);
    const num = buildOrderNumberMap(refs);
    type O = { id: string; status: string; total_amount: string | number; created_at: string; updated_at: string | null; delivery_method: string | null; shipping_method: string | null; shipping_address: { firstName?: string; lastName?: string; zipCode?: string; city?: string } | null; pickup_code_verified_at: string | null; profile: unknown };
    const nameOf = (o: O) => {
      const p = (Array.isArray(o.profile) ? o.profile[0] : o.profile) as { full_name?: string | null } | null;
      const full = p?.full_name || [o.shipping_address?.firstName, o.shipping_address?.lastName].filter(Boolean).join(' ');
      if (!full) return 'Client';
      const [first, ...rest] = full.trim().split(/\s+/);
      return rest.length ? `${first} ${rest[rest.length - 1].charAt(0)}.` : first;
    };
    const events: { at: string; kind: 'sale' | 'cart' | 'pickup' | 'shipped' | 'return'; text: string; amount: number | null; href: string | null }[] = [];
    for (const o of (ords ?? []) as O[]) {
      const n = num.get(o.id);
      const ref = n ? `n°${n}` : 'commande';
      const amount = Number(o.total_amount) || 0;
      const created = new Date(o.created_at);
      if (created >= since36h) {
        if (['paid', 'supplier_ordered', 'shipped', 'delivered'].includes(o.status)) {
          events.push({ at: o.created_at, kind: 'sale', text: `${nameOf(o)} a payé la ${ref}${o.delivery_method === 'pickup' ? ' · retrait en boutique' : ''}`, amount, href: `/admin/orders/${o.id}` });
        } else if (o.status === 'pending' || o.status === 'awaiting_payment') {
          events.push({ at: o.created_at, kind: 'cart', text: `${nameOf(o)} est arrivé au paiement sans finir`, amount, href: '/admin/carts' });
        }
      }
      if (o.pickup_code_verified_at && new Date(o.pickup_code_verified_at) >= since36h) {
        events.push({ at: o.pickup_code_verified_at, kind: 'pickup', text: `${nameOf(o)} a retiré sa ${ref} en boutique (code vérifié)`, amount: null, href: `/admin/orders/${o.id}` });
      }
    }
    for (const r of rets ?? []) {
      events.push({ at: r.created_at as string, kind: 'return', text: `Demande de retour ${r.rma_number}`, amount: null, href: `/admin/returns/${r.id}` });
    }
    events.sort((a, b) => b.at.localeCompare(a.at));

    const parcels = ((ords ?? []) as O[])
      .filter((o) => o.status === 'shipped' && o.delivery_method !== 'pickup')
      .slice(0, 12)
      .map((o) => ({
        id: o.id,
        ref: num.get(o.id) ? `n°${num.get(o.id)}` : '',
        city: o.shipping_address?.city || '—',
        lonlat: lonLatOfZip(o.shipping_address?.zipCode),
        carrier: o.shipping_method === 'mondial_relay' ? 'Mondial Relay' : o.shipping_method?.startsWith('chronopost') ? 'Chronopost' : 'Transporteur',
        since: o.updated_at || o.created_at,
      }));

    return NextResponse.json({
      trackingReady,
      now: now.toISOString(),
      parisHour: nowHour,
      shop: SHOP_LONLAT,
      online: online.length,
      visitsToday,
      salesToday: { net: Math.round(salesToday.reduce((s, o) => s + o.net, 0)), orders: salesToday.length },
      countries: Array.from(byCountry.values()).sort((a, b) => b.n - a.n),
      visitors,
      watched,
      events: events.slice(0, 40),
      parcels,
      affluence,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
