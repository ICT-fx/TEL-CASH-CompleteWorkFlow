# Relance paniers abandonnés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compléter la relance email des commandes abandonnées (déjà en place) en y ajoutant un code promo **-5 % personnel valable 7 jours**, en ciblant aussi les checkouts **expirés (`cancelled` jamais payés)**, en câblant le code jusqu'au paiement, et en ajoutant une **désinscription RGPD**.

**Architecture :** Brownfield. Le socle existe déjà et est commité : route `GET /api/cron/abandoned-cart` (cron Vercel quotidien), fonction `sendAbandonedCartEmail()` (avec un paramètre `promoCode` **déjà plumbé mais inutilisé**), colonne `orders.abandoned_reminder_sent_at` (migration 031), page admin `/admin/carts`. Ce plan **étend** ces éléments — il ne les recrée pas.

**Tech Stack :** Next.js 15 (App Router), Supabase (service-role via `createAdminClient()`), Resend/SMTP (`src/lib/email.ts`), Zustand (`src/store/useCart.ts`), Vitest (tests unitaires des helpers purs).

## État existant (déjà commité — NE PAS recréer)

| Élément | Fichier | État |
|---|---|---|
| Colonne anti-doublon | `orders.abandoned_reminder_sent_at` (migration `031_abandoned_cart_reminder.sql`) | ✅ en place |
| Cron relance | `src/app/api/cron/abandoned-cart/route.ts` | ✅ cible `pending` 24 h–7 j, **sans promo** |
| Template email | `sendAbandonedCartEmail()` dans `src/lib/email.ts` | ✅ accepte déjà `promoCode?: { code; label }` (non utilisé) |
| Cron Vercel | `vercel.json` → `/api/cron/abandoned-cart` @ `0 10 * * *` | ✅ en place |
| Page admin | `src/app/admin/carts/page.tsx` (+ lien nav « Paniers ») | ✅ (non concernée par ce plan) |

## Ce que ce plan ajoute (le delta réel)

1. Colonnes `expires_at` + `source` sur `referral_codes` ; `marketing_opt_out` + `unsubscribe_token` sur `profiles` (migration **034**).
2. Respect de l'expiration des codes dans `/api/referral/validate` **et** `/api/checkout`.
3. Génération d'un code `REVIENS-XXXXX` (-5 %, usage unique, expire +7 j, `source='winback'`) par le cron, passé à l'email via le paramètre `promoCode` déjà prévu.
4. Élargissement du ciblage du cron : `pending` **et** `cancelled` jamais payés ; passage du délai à **48 h**, fenêtre **14 j** ; exclusion opt-out ; garde anti-spam (1 email/client/run, cooldown 30 j, exclusion des clients ayant déjà racheté).
5. Câblage du code du panier jusqu'au checkout (le lien email `/cart?...&promo=CODE`).
6. Désinscription RGPD `/desinscription?token=…` + lien dans l'email.

## Global Constraints

- **Réutiliser l'existant** : route `/api/cron/abandoned-cart`, fonction `sendAbandonedCartEmail`, colonne `abandoned_reminder_sent_at`. Interdit d'en créer des doublons (`winback`, etc.).
- **Prochain numéro de migration : `034`** (031/032/033 sont déjà pris : `031_abandoned_cart_reminder.sql`, `032_page_views.sql`, `033_guest_checkout.sql`).
- **Remise : -5 %**, `discount_type='percent'`, `discount_value=5`, `max_uses=1`, **expire à +7 jours**, `source='winback'`, préfixe de code **`REVIENS-`**.
- **Délai relance : ≥ 48 h** après création ; **fenêtre ≤ 14 j**.
- **Cible `cancelled`** uniquement si **jamais payée** : `stripe_payment_intent IS NULL AND refunded_at IS NULL` (sinon on relancerait une commande payée puis remboursée par l'admin).
- **Texte en français** (UI, emails, messages).
- **Pas de fichier de types Supabase généré** : on ajoute les colonnes directement, types inline maintenus à la main.
- **Vérification** : `npm run lint` est cassé → utiliser `npx tsc --noEmit --skipLibCheck`. Tests unitaires des helpers purs via `npm run test` (Vitest). Vérif d'intégration du cron via `?dryRun=1`.
- **Expéditeur** : inchangé (`infos@telandcash.fr` via `EMAIL_FROM`/`RESEND_FROM`/SMTP), résolu par le code email existant.

---

### Task 1: Migration 034 — expiration/source des codes + opt-out RGPD

**Files:**
- Create: `supabase/migrations/034_winback_promo_and_optout.sql`

**Interfaces:**
- Produces (colonnes utilisées par les tâches suivantes) :
  - `referral_codes.expires_at TIMESTAMPTZ` (NULL = jamais expiré), `referral_codes.source TEXT NOT NULL DEFAULT 'referral'`
  - `profiles.marketing_opt_out BOOLEAN NOT NULL DEFAULT false`, `profiles.unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid()`

- [ ] **Step 1: Écrire la migration**

```sql
-- ========================================
-- TEL & CASH — Migration 034
-- Relance paniers abandonnés : code promo expirable (-5 %) + opt-out RGPD
-- ========================================

-- 1) Codes promo : expiration + provenance (distingue les codes de relance
--    'winback' des codes de parrainage 'referral' existants).
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'referral';

COMMENT ON COLUMN public.referral_codes.expires_at IS
  'Expiration du code (NULL = jamais). Vérifiée par /api/referral/validate et /api/checkout.';
COMMENT ON COLUMN public.referral_codes.source IS
  'Provenance : ''referral'' (parrainage) ou ''winback'' (relance panier abandonné).';

-- 2) Profils : opt-out marketing + jeton de désinscription non devinable.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

COMMENT ON COLUMN public.profiles.marketing_opt_out IS
  'true = le client a demandé à ne plus recevoir les relances. Respecté par /api/cron/abandoned-cart.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unsubscribe_token
  ON public.profiles (unsubscribe_token);

-- 3) Index partiel du cron élargi (pending OU cancelled non relancés).
CREATE INDEX IF NOT EXISTS idx_orders_abandoned_reminder_v2
  ON public.orders (created_at)
  WHERE abandoned_reminder_sent_at IS NULL AND status IN ('pending', 'cancelled');
```

- [ ] **Step 2: Appliquer la migration sur Supabase**

Projet cible : `klungktcrjlwxqfbbbec` (« TEL&Cash Backend »). Appliquer via l'outil MCP `apply_migration` (name: `winback_promo_and_optout`) **ou** via le SQL editor du dashboard. ⚠️ Changement de base réel — confirmer le bon projet avant d'exécuter.

- [ ] **Step 3: Vérifier les colonnes**

Exécuter (MCP `execute_sql` ou dashboard) :
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name in ('referral_codes','profiles')
  and column_name in ('expires_at','source','marketing_opt_out','unsubscribe_token')
order by column_name;
```
Attendu : 4 lignes (`expires_at`, `marketing_opt_out`, `source`, `unsubscribe_token`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/034_winback_promo_and_optout.sql
git commit -m "feat(db): migration 034 — expiration codes promo + opt-out RGPD"
```

---

### Task 2: Helper d'usabilité des codes + application de l'expiration

**Files:**
- Create: `src/lib/referral.ts`
- Create: `src/lib/referral.test.ts`
- Modify: `src/app/api/referral/validate/route.ts`
- Modify: `src/app/api/checkout/route.ts` (bloc remise, ~lignes 90-103)

**Interfaces:**
- Produces : `isReferralCodeUsable(code: ReferralCodeUsability, now: Date): boolean` où
  `ReferralCodeUsability = { is_active: boolean; times_used: number; max_uses: number; expires_at: string | null }`.

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/referral.test.ts
import { describe, it, expect } from 'vitest';
import { isReferralCodeUsable } from './referral';

const NOW = new Date('2026-07-07T12:00:00Z');
const base = { is_active: true, times_used: 0, max_uses: 1, expires_at: null as string | null };

describe('isReferralCodeUsable', () => {
  it('accepte un code actif, non épuisé, sans expiration', () => {
    expect(isReferralCodeUsable(base, NOW)).toBe(true);
  });
  it('refuse un code inactif', () => {
    expect(isReferralCodeUsable({ ...base, is_active: false }, NOW)).toBe(false);
  });
  it('refuse un code épuisé', () => {
    expect(isReferralCodeUsable({ ...base, times_used: 1, max_uses: 1 }, NOW)).toBe(false);
  });
  it('refuse un code expiré (expires_at passé)', () => {
    expect(isReferralCodeUsable({ ...base, expires_at: '2026-07-06T12:00:00Z' }, NOW)).toBe(false);
  });
  it('accepte un code non encore expiré (expires_at futur)', () => {
    expect(isReferralCodeUsable({ ...base, expires_at: '2026-07-14T12:00:00Z' }, NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test — il doit échouer**

Run: `npm run test -- src/lib/referral.test.ts`
Expected: FAIL (`Cannot find module './referral'` ou `isReferralCodeUsable is not a function`).

- [ ] **Step 3: Implémenter le helper**

```typescript
// src/lib/referral.ts
// Règles d'usabilité d'un code promo, partagées par la validation et le checkout.
// Un code est utilisable s'il est actif, non épuisé, et non expiré.
export interface ReferralCodeUsability {
  is_active: boolean;
  times_used: number;
  max_uses: number;
  expires_at: string | null;
}

export function isReferralCodeUsable(code: ReferralCodeUsability, now: Date): boolean {
  if (!code.is_active) return false;
  if (code.times_used >= code.max_uses) return false;
  if (code.expires_at && new Date(code.expires_at).getTime() <= now.getTime()) return false;
  return true;
}
```

- [ ] **Step 4: Lancer le test — il doit passer**

Run: `npm run test -- src/lib/referral.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Brancher l'expiration dans `/api/referral/validate`**

Remplacer le corps de la fonction `POST` (fichier `src/app/api/referral/validate/route.ts`) par :

```typescript
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isReferralCodeUsable } from '@/lib/referral';

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
      .select('code, discount_value, discount_type, is_active, times_used, max_uses, expires_at')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !referralCode) {
      return NextResponse.json({ valid: false, error: 'Code introuvable' }, { status: 404 });
    }

    if (!isReferralCodeUsable(referralCode, new Date())) {
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
```

- [ ] **Step 6: Brancher l'expiration dans `/api/checkout`**

Dans `src/app/api/checkout/route.ts`, le bloc actuel (~l.90-103) sélectionne le code avec `.eq('is_active', true)` puis teste `code.times_used < code.max_uses`. Le remplacer par (ajouter l'import `isReferralCodeUsable` en tête de fichier) :

```typescript
    // Calculate discount if referral code provided
    let discountAmount = 0;
    if (referral_code) {
      const { data: code } = await adminDb
        .from('referral_codes')
        .select('*')
        .eq('code', referral_code)
        .single();

      if (code && isReferralCodeUsable(code, new Date())) {
        if (code.discount_type === 'fixed') {
          discountAmount = parseFloat(code.discount_value as unknown as string);
        } else {
          const subtotal = cartItems.reduce(
            (sum, i) => sum + priceOf(i) * i.quantity, 0
          );
          discountAmount = subtotal * (parseFloat(code.discount_value as unknown as string) / 100);
        }
      }
    }
```

- [ ] **Step 7: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add src/lib/referral.ts src/lib/referral.test.ts src/app/api/referral/validate/route.ts src/app/api/checkout/route.ts
git commit -m "feat(promo): appliquer l'expiration des codes (validate + checkout)"
```

---

### Task 3: Helpers de génération du code de relance

**Files:**
- Create: `src/lib/winback.ts`
- Create: `src/lib/winback.test.ts`

**Interfaces:**
- Produces :
  - `WINBACK_DISCOUNT_PCT = 5`, `WINBACK_VALIDITY_DAYS = 7`
  - `buildWinbackCode(rand: string): string` → `REVIENS-XXXXX` (majuscules)
  - `winbackExpiry(now: Date): string` → ISO `now + 7 j`
  - `createWinbackCode(db: SupabaseLike, userId: string, now: Date): Promise<string>` → insère un code unique et renvoie le `code` (retry si collision UNIQUE)

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/winback.test.ts
import { describe, it, expect } from 'vitest';
import { buildWinbackCode, winbackExpiry, WINBACK_VALIDITY_DAYS } from './winback';

describe('buildWinbackCode', () => {
  it('préfixe REVIENS- et met en majuscules', () => {
    expect(buildWinbackCode('a7k2b')).toBe('REVIENS-A7K2B');
  });
});

describe('winbackExpiry', () => {
  it('renvoie now + 7 jours en ISO', () => {
    const now = new Date('2026-07-07T12:00:00Z');
    const exp = new Date(winbackExpiry(now));
    const diffDays = (exp.getTime() - now.getTime()) / 86400_000;
    expect(diffDays).toBe(WINBACK_VALIDITY_DAYS);
  });
});
```

- [ ] **Step 2: Lancer le test — il doit échouer**

Run: `npm run test -- src/lib/winback.test.ts`
Expected: FAIL (`Cannot find module './winback'`).

- [ ] **Step 3: Implémenter les helpers**

```typescript
// src/lib/winback.ts
// Génération des codes promo de relance « panier abandonné » (-5 %, usage
// unique, expire à +7 j). Codes préfixés REVIENS- pour les distinguer des
// codes de parrainage (TC-…), source='winback' en base.

export const WINBACK_DISCOUNT_PCT = 5;
export const WINBACK_VALIDITY_DAYS = 7;

export function buildWinbackCode(rand: string): string {
  return `REVIENS-${rand.toUpperCase()}`;
}

export function winbackExpiry(now: Date): string {
  return new Date(now.getTime() + WINBACK_VALIDITY_DAYS * 86400_000).toISOString();
}

// Interface minimale du client Supabase admin (insert sur referral_codes).
interface SupabaseLike {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => {
      select: () => { single: () => Promise<{ data: unknown; error: { code?: string; message: string } | null }> };
    };
  };
}

function randomPart(): string {
  // Même famille que le parrainage : 5 caractères base36.
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Insère un code de relance -5 % pour un utilisateur et renvoie le code.
// Retry en cas de collision de la contrainte UNIQUE sur `code`.
export async function createWinbackCode(db: SupabaseLike, userId: string, now: Date): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = buildWinbackCode(randomPart());
    const { error } = await db
      .from('referral_codes')
      .insert({
        user_id: userId,
        code,
        discount_value: WINBACK_DISCOUNT_PCT,
        discount_type: 'percent',
        max_uses: 1,
        is_active: true,
        expires_at: winbackExpiry(now),
        source: 'winback',
      })
      .select()
      .single();
    if (!error) return code;
    // 23505 = unique_violation → on régénère un code.
    if (error.code !== '23505') throw new Error(`createWinbackCode: ${error.message}`);
  }
  throw new Error('createWinbackCode: impossible de générer un code unique après 5 essais');
}
```

- [ ] **Step 4: Lancer le test — il doit passer**

Run: `npm run test -- src/lib/winback.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/lib/winback.ts src/lib/winback.test.ts
git commit -m "feat(promo): helpers de génération des codes de relance -5%"
```

---

### Task 4: Ajouter le lien de désinscription à l'email de relance

**Files:**
- Modify: `src/lib/email.ts` (fonction `sendAbandonedCartEmail`, ~l.265-311)

**Interfaces:**
- Consumes : signature existante `sendAbandonedCartEmail(opts)` avec `promoCode?`.
- Produces : `opts.unsubscribeUrl?: string` — si fourni, un lien « Se désinscrire » est rendu en pied d'email.

- [ ] **Step 1: Ajouter le paramètre à la signature**

Dans `src/lib/email.ts`, dans l'objet `opts` de `sendAbandonedCartEmail`, ajouter après `promoCode` :

```typescript
  promoCode?: { code: string; label: string } | null; // ex. { code: 'REVIENS-A7K2B', label: '-5 %' }
  unsubscribeUrl?: string; // lien RGPD de désinscription (pied d'email)
```

- [ ] **Step 2: Rendre le pied de page de désinscription**

Toujours dans `sendAbandonedCartEmail`, remplacer le paragraphe de pied existant :

```typescript
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Une question ? Répondez à cet email ou écrivez-nous à infos@telandcash.fr — garantie 24 mois incluse.
      </p>
```

par :

```typescript
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Une question ? Répondez à cet email ou écrivez-nous à infos@telandcash.fr — garantie 24 mois incluse.
      </p>
      ${opts.unsubscribeUrl
        ? `<p style="color:#B7BECC;font-size:11px;line-height:1.5;margin-top:10px">
             Vous ne souhaitez plus recevoir ces relances ?
             <a href="${opts.unsubscribeUrl}" style="color:#B7BECC;text-decoration:underline">Se désinscrire</a>.
           </p>`
        : ''}
```

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): lien de désinscription RGPD dans la relance panier"
```

---

### Task 5: Étendre le cron — cancelled non payés, 48 h, code -5 %, anti-spam, opt-out

**Files:**
- Modify: `src/app/api/cron/abandoned-cart/route.ts` (réécriture ciblée)

**Interfaces:**
- Consumes : `createWinbackCode`, `winbackExpiry` (Task 3) ; `sendAbandonedCartEmail` avec `promoCode` + `unsubscribeUrl` (Task 4) ; colonnes de la Task 1.

- [ ] **Step 1: Mettre à jour les constantes de fenêtre**

Remplacer :
```typescript
const MIN_AGE_HOURS = 24;
const MAX_AGE_DAYS = 7;
```
par :
```typescript
// Relance ~2 jours après. Plancher 48 h ; plafond 14 j pour ne pas arroser
// d'anciennes commandes au premier passage.
const MIN_AGE_HOURS = 48;
const MAX_AGE_DAYS = 14;
// Ne pas renvoyer une relance au même client dans cette fenêtre glissante.
const USER_COOLDOWN_DAYS = 30;
```

- [ ] **Step 2: Ajouter les imports**

En tête de fichier, compléter les imports :
```typescript
import { createWinbackCode } from '@/lib/winback';
```

- [ ] **Step 3: Élargir la sélection (pending + cancelled non payés) et charger opt-out/token**

Remplacer le bloc `// 1) Paniers abandonnés candidats à relancer.` (le `select(...)` sur `orders` + `.eq('status','pending')`) par :

```typescript
  // 1) Paniers abandonnés candidats : checkout démarré non payé.
  //    - 'pending' : le webhook ne l'a jamais passé à 'paid'.
  //    - 'cancelled' JAMAIS payé (session Stripe expirée) : pas de payment
  //      intent ni de remboursement (sinon = commande payée annulée par l'admin).
  const { data: orders, error } = await db
    .from('orders')
    .select('id, user_id, status, created_at, total_amount, shipping_address, stripe_payment_intent, refunded_at, profile:profiles(email, full_name, marketing_opt_out, unsubscribe_token)')
    .in('status', ['pending', 'cancelled'])
    .is('abandoned_reminder_sent_at', null)
    .lte('created_at', cutoffRecent)
    .gte('created_at', cutoffOld)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: `Lecture commandes: ${error.message}` }, { status: 500 });
  }

  // Garde « jamais payé » pour les commandes 'cancelled'.
  const neverPaid = (o: { status: string; stripe_payment_intent: unknown; refunded_at: unknown }) =>
    o.status === 'pending' || (!o.stripe_payment_intent && !o.refunded_at);

  const candidates = (orders || []).filter(neverPaid);
```

- [ ] **Step 4: Étendre les accès profil (opt-out + token)**

Remplacer les helpers `emailOf` / `nameOf` par une version qui expose aussi l'opt-out et le token :

```typescript
  interface ProfileRef {
    email: string | null;
    full_name: string | null;
    marketing_opt_out: boolean | null;
    unsubscribe_token: string | null;
  }
  const profileOf = (o: { profile: unknown }): ProfileRef | null =>
    Array.isArray(o.profile) ? ((o.profile[0] as ProfileRef) ?? null) : ((o.profile as ProfileRef) ?? null);

  const emailOf = (o: { shipping_address: unknown; profile: unknown }): string | null => {
    const fromProfile = profileOf(o)?.email?.trim();
    if (fromProfile) return fromProfile;
    const addr = o.shipping_address as { email?: string } | null;
    return addr?.email?.trim() || null;
  };
  const nameOf = (o: { profile: unknown }): string | null => profileOf(o)?.full_name ?? null;
```

Puis, remplacer la ligne `const withEmail = candidates.filter((o) => emailOf(o));` par une chaîne de gardes :

```typescript
  // Gardes : email présent + pas d'opt-out RGPD.
  const eligible = candidates.filter((o) => emailOf(o) && profileOf(o)?.marketing_opt_out !== true);

  // Anti-spam : 1 relance par client par run (on garde la commande la plus récente,
  // la liste est triée created_at desc).
  const seenUser = new Set<string>();
  const dedup = eligible.filter((o) => {
    const uid = (o as { user_id: string | null }).user_id;
    const key = uid || `email:${emailOf(o)}`;
    if (seenUser.has(key)) return false;
    seenUser.add(key);
    return true;
  });

  // Anti-spam : cooldown 30 j + clients ayant déjà racheté (commande payée après l'abandon).
  const userIds = Array.from(new Set(dedup.map((o) => (o as { user_id: string | null }).user_id).filter(Boolean))) as string[];
  const onCooldown = new Set<string>();
  const boughtSince = new Map<string, number>(); // user_id -> timestamp de la 1re commande payée
  if (userIds.length > 0) {
    const cooldownFrom = new Date(now - USER_COOLDOWN_DAYS * 86400_000).toISOString();
    const { data: recent } = await db
      .from('orders')
      .select('user_id, abandoned_reminder_sent_at')
      .in('user_id', userIds)
      .gte('abandoned_reminder_sent_at', cooldownFrom);
    for (const r of recent || []) if (r.user_id) onCooldown.add(r.user_id as string);

    const { data: paid } = await db
      .from('orders')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .in('status', ['paid', 'shipped', 'delivered']);
    for (const p of paid || []) {
      if (!p.user_id) continue;
      const t = new Date(p.created_at as string).getTime();
      const prev = boughtSince.get(p.user_id as string);
      if (prev == null || t < prev) boughtSince.set(p.user_id as string, t);
    }
  }

  const withEmail = dedup.filter((o) => {
    const uid = (o as { user_id: string | null }).user_id;
    if (!uid) return true; // pas de compte lié (email seul) : pas de cooldown possible
    if (onCooldown.has(uid)) return false;
    const boughtAt = boughtSince.get(uid);
    // Exclure si le client a une commande payée POSTÉRIEURE à cet abandon.
    if (boughtAt != null && boughtAt > new Date((o as { created_at: string }).created_at).getTime()) return false;
    return true;
  });
```

- [ ] **Step 5: Générer le code -5 % et l'attacher à l'email (boucle d'envoi)**

Remplacer la boucle d'envoi `for (const o of withEmail) { ... }` par :

```typescript
  let sent = 0;
  const failures: { id: string; reason?: string }[] = [];
  for (const o of withEmail) {
    const to = emailOf(o)!;
    const uid = (o as { user_id: string | null }).user_id;

    // Génère un code -5 % perso (expire +7 j). Sans compte lié, pas de code
    // (le code parrainage est per-user) → relance simple sans remise.
    let promo: { code: string; label: string } | null = null;
    if (uid) {
      try {
        const code = await createWinbackCode(db, uid, new Date(now));
        promo = { code, label: `-${5} %` };
      } catch (e) {
        console.error(`[abandoned-cart] Code promo non généré pour ${o.id}: ${(e as Error).message}`);
      }
    }

    const token = profileOf(o)?.unsubscribe_token || null;
    const resumeUrl = `${appUrl}/cart?relance=${o.id.slice(0, 8)}${promo ? `&promo=${promo.code}` : ''}`;
    const unsubscribeUrl = token ? `${appUrl}/desinscription?token=${token}` : undefined;

    const result = await sendAbandonedCartEmail({
      to,
      customerName: nameOf(o),
      resumeUrl,
      lines: linesByOrder.get(o.id) || [],
      total: parseFloat(o.total_amount as unknown as string) || 0,
      promoCode: promo,
      unsubscribeUrl,
    });

    if (result.sent) {
      const { error: markErr } = await db
        .from('orders')
        .update({ abandoned_reminder_sent_at: new Date().toISOString() })
        .eq('id', o.id);
      if (markErr) console.error(`[abandoned-cart] Marquage échoué pour ${o.id}: ${markErr.message}`);
      sent++;
    } else {
      failures.push({ id: o.id, reason: result.reason });
      console.error(`[abandoned-cart] Envoi échoué pour ${o.id}: ${result.reason}`);
    }
  }
```

> Note : la ligne `const ids = withEmail.map((o) => o.id);` (chargement des `order_items`) reste inchangée, mais doit désormais s'exécuter **après** le calcul de `withEmail` ci-dessus. Vérifier l'ordre : (1) sélection+gardes → `withEmail`, (2) chargement des lignes `linesByOrder`, (3) `dryRun` renvoie l'échantillon, (4) boucle d'envoi.

- [ ] **Step 6: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 7: Vérifier la sélection en dry-run (aucun envoi)**

Démarrer le serveur (`npm run dev`) puis, connecté en admin (ou avec `CRON_SECRET`) :
Run: `curl -s "http://localhost:3000/api/cron/abandoned-cart?dryRun=1" -H "Authorization: Bearer $CRON_SECRET" | jq`
Expected: JSON `{ dryRun: true, emailConfigured: …, candidates, withEmail, sample: [...] }`. Vérifier que `sample` ne contient QUE des commandes non payées ≥ 48 h, sans doublon de client.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/cron/abandoned-cart/route.ts
git commit -m "feat(relance): cibler cancelled non payés + code -5% + anti-spam + opt-out"
```

---

### Task 6: Câbler le code promo du panier jusqu'au checkout

**Files:**
- Modify: `src/store/useCart.ts` (store + persistance)
- Modify: `src/app/cart/page.tsx` (lecture de `?promo`)
- Modify: `src/app/checkout/page.tsx` (envoi de `referral_code`)

**Interfaces:**
- Produces : `useCart().promoCode: string | null` + `useCart().setPromoCode(code: string | null)`, persistés dans `localStorage` (clé `telcash-cart`).

- [ ] **Step 1: Ajouter `promoCode` au store**

Dans `src/store/useCart.ts` :

a) Interface `CartStore`, ajouter après `items: CartItem[];` :
```typescript
  promoCode: string | null;
  setPromoCode: (code: string | null) => void;
```

b) État initial, après `items: [],` :
```typescript
      promoCode: null,
      setPromoCode: (code) => set({ promoCode: code ? code.toUpperCase() : null }),
```

c) `clearCart`, le rendre :
```typescript
      clearCart: () => set({ items: [], promoCode: null }),
```

d) `partialize`, persister aussi le code :
```typescript
      partialize: (state) => ({ items: state.items, promoCode: state.promoCode }),
```

- [ ] **Step 2: Lire `?promo` sur la page panier**

Dans `src/app/cart/page.tsx` :

a) Ajouter aux imports React/Next (haut du fichier) :
```typescript
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
```
(si `useEffect` est déjà importé, ne pas le dupliquer).

b) Dans le composant, après les hooks existants, ajouter :
```typescript
  const searchParams = useSearchParams();
  const setPromoCode = useCart((s) => s.setPromoCode);
  useEffect(() => {
    const promo = searchParams.get('promo');
    if (promo) setPromoCode(promo);
  }, [searchParams, setPromoCode]);
```

> Le lien « Passer au paiement » (`<Link href="/checkout">`) reste inchangé : le code est désormais dans le store persistant.

- [ ] **Step 3: Envoyer `referral_code` au checkout**

Dans `src/app/checkout/page.tsx` :

a) Récupérer le code depuis le store (près des autres `useCart(...)`) :
```typescript
  const promoCode = useCart((s) => s.promoCode);
```

b) Dans l'appel `fetch('/api/checkout', …)`, ajouter le champ au corps POST :
```typescript
        body: JSON.stringify({
          shipping_method: shippingMethod,
          shipping_address: {
            ...formData,
            phone: `${formData.phoneCode || '+33'}${formData.phone.replace(/^0/, '')}`
          },
          referral_code: promoCode || undefined,
        }),
```

- [ ] **Step 4: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 5: Vérifier manuellement le bout-en-bout de la remise**

1. Créer un code de test en base : `insert into referral_codes (user_id, code, discount_value, discount_type, max_uses, source, expires_at) values ('<un user id>', 'REVIENS-TEST1', 5, 'percent', 1, 'winback', now() + interval '7 days');`
2. `npm run dev`, se connecter avec ce user, mettre un article au panier.
3. Ouvrir `http://localhost:3000/cart?promo=REVIENS-TEST1`, cliquer « Passer au paiement », aller jusqu'à la création de session.
4. Vérifier en base que la commande créée a `referral_code_used='REVIENS-TEST1'` et `discount_amount` = 5 % du sous-total.

- [ ] **Step 6: Commit**

```bash
git add src/store/useCart.ts src/app/cart/page.tsx src/app/checkout/page.tsx
git commit -m "feat(checkout): propager le code promo panier -> commande"
```

---

### Task 7: Page de désinscription RGPD

**Files:**
- Create: `src/app/desinscription/page.tsx` (Server Component)

**Interfaces:**
- Consumes : `profiles.unsubscribe_token`, `profiles.marketing_opt_out` (Task 1) ; `createAdminClient()`.

- [ ] **Step 1: Créer la page de désinscription**

```tsx
// src/app/desinscription/page.tsx
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
    const { error } = await db
      .from('profiles')
      .update({ marketing_opt_out: true })
      .eq('unsubscribe_token', token);
    ok = !error;
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
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier manuellement**

1. Récupérer un `unsubscribe_token` : `select unsubscribe_token from profiles limit 1;`
2. `npm run dev`, ouvrir `http://localhost:3000/desinscription?token=<token>`.
3. Vérifier le message de succès, puis en base : `select marketing_opt_out from profiles where unsubscribe_token='<token>';` → `true`.
4. Ouvrir avec un token bidon → message d'erreur, aucune ligne modifiée.

- [ ] **Step 4: Commit**

```bash
git add src/app/desinscription/page.tsx
git commit -m "feat(rgpd): page de désinscription des relances (/desinscription)"
```

---

## Séquence & dépendances

1 (migration) → 2 (expiration) → 3 (helpers code) → 4 (email lien) → 5 (cron, dépend de 3+4) → 6 (checkout, dépend de 2) → 7 (désinscription, dépend de 1).

## Vérification finale (après toutes les tâches)

- [ ] `npm run test` → tous les tests unitaires passent.
- [ ] `npx tsc --noEmit --skipLibCheck` → aucune erreur.
- [ ] `npm run build` → build OK (Next.js compile les nouvelles routes/pages).
- [ ] `GET /api/cron/abandoned-cart?dryRun=1` → sélection correcte (non payés ≥ 48 h, sans doublon client, opt-out exclus).
- [ ] Parcours remise `/cart?promo=…` → commande créée avec `discount_amount` = 5 %.
- [ ] `/desinscription?token=…` → `marketing_opt_out=true`.

## Self-Review (couverture spec)

- Cible pending + cancelled non payés → Task 5 ✅ (garde `neverPaid` = amélioration vs l'existant qui ne visait que `pending`).
- Délai 48 h / fenêtre 14 j → Task 5 ✅.
- Code -5 % perso, usage unique, expire 7 j → Tasks 3 + 5 ✅.
- Expiration respectée validate + checkout → Task 2 ✅.
- Câblage promo au paiement → Task 6 ✅.
- Désinscription RGPD + lien email + exclusion cron → Tasks 1, 4, 5, 7 ✅.
- Anti-doublon (existant) + anti-spam (cooldown, dedupe, déjà-racheté) → Task 5 ✅.
- Réutilisation infra email/cron/expéditeur → tout le plan ✅.
