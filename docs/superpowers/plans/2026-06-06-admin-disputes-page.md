# Page admin « Litiges » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'admin une vue centralisée en lecture seule des litiges Stripe, reliée au dossier de preuves déjà collecté, et garder le statut des litiges à jour via le webhook.

**Architecture:** On lit la table `disputes` (déjà alimentée par le webhook `charge.dispute.created`) via une nouvelle route admin, on l'affiche dans une page `/admin/disputes` calquée sur `/admin/orders`, et chaque ligne renvoie vers le détail commande existant (qui affiche déjà les preuves). On ajoute au webhook les events `charge.dispute.updated`/`closed` pour rafraîchir `disputes.status`. La soumission des preuves reste manuelle dans le dashboard Stripe.

**Tech Stack:** Next.js 15 App Router, Supabase (client admin service-role), Stripe webhooks, lucide-react, React client components.

> **Pas de framework de test dans ce repo.** Les étapes de vérification utilisent : la requête Supabase REST (pour valider le `select`), le Stripe CLI déjà lancé (`stripe trigger`), et un contrôle visuel de l'UI connecté en admin. Aucune migration SQL n'est nécessaire (la table `disputes` existe déjà ; pas de colonne `updated_at`).

---

## File Structure

- **Create** `src/app/api/admin/disputes/route.ts` — `GET` : liste des litiges + commande/profil liés.
- **Modify** `src/app/api/webhooks/stripe/route.ts` — ajout des cas `charge.dispute.updated` / `charge.dispute.closed`.
- **Create** `src/app/admin/disputes/page.tsx` — page liste lecture seule.
- **Modify** `src/app/admin/layout.tsx` — entrée sidebar « Litiges ».

Schéma `disputes` (confirmé) : `id, order_id (FK orders.id, nullable), stripe_dispute_id, stripe_charge_id, amount (numeric), currency, reason, status, created_at`.

---

## Task 1 : Route API `GET /api/admin/disputes`

**Files:**
- Create: `src/app/api/admin/disputes/route.ts`

- [ ] **Step 1 : Vérifier que la jointure imbriquée fonctionne (Supabase REST)**

Run (le `.env.local` fournit URL + service key) :
```bash
set -a; source .env.local; set +a
curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/disputes?select=*,order:orders(id,order_number,total_amount,status,profile:profiles(email,full_name))&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```
Expected : un JSON array (au moins le litige existant `du_1TOtoj…` avec `order: null` puisque son `order_id` est null). Si erreur de relation, fallback : retirer le niveau `profile:profiles(...)` et résoudre le profil en 2e requête.

- [ ] **Step 2 : Écrire la route**

```typescript
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/disputes — liste des litiges Stripe (lecture seule)
export async function GET(request: Request) {
  try {
    const { profile, response } = await requireAdmin();
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
```

- [ ] **Step 3 : Vérifier la route via l'UI/admin connecté**

Le serveur dev tourne déjà sur :3000. Connecté en admin dans le navigateur, ouvrir la console et exécuter :
```js
fetch('/api/admin/disputes').then(r => r.json()).then(console.log)
```
Expected : `{ disputes: [ { id, stripe_dispute_id, amount, reason, status, order: null|{...} } ] }`. Un `fetch` sans session renvoie 401 (normal — `requireAdmin`).

- [ ] **Step 4 : Commit**

```bash
git add src/app/api/admin/disputes/route.ts
git commit -m "feat(admin): API liste des litiges (GET /api/admin/disputes)"
```

---

## Task 2 : Webhook — rafraîchir le statut sur `dispute.updated` / `dispute.closed`

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts` (insérer un nouveau `case` juste avant le `default:` du `switch (event.type)`, après le bloc `case 'charge.dispute.created'`)

- [ ] **Step 1 : Ajouter les cas au switch**

Insérer ce bloc immédiatement avant la ligne `default:` du switch (actuellement après la fin du `case 'charge.dispute.created'`) :

```typescript
      // ── 9. Litige mis à jour / clôturé — rafraîchit le statut ──────────────
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        await supabase
          .from('disputes')
          .update({ status: dispute.status })
          .eq('stripe_dispute_id', dispute.id);
        console.log(`⚖️  Dispute ${dispute.id} → ${dispute.status}`);
        // Décision produit : on NE change PAS le statut de la commande même si
        // dispute.status === 'lost'. L'admin décide d'un éventuel passage en refunded.
        break;
      }
```

- [ ] **Step 2 : Vérifier que le projet compile**

Run:
```bash
npm run lint
```
Expected : pas d'erreur sur `src/app/api/webhooks/stripe/route.ts` (les types `Stripe.Dispute` sont déjà importés via `import Stripe from 'stripe'` en tête de fichier).

- [ ] **Step 3 : Vérifier la réception du webhook (Stripe CLI déjà lancé)**

Le `stripe listen` forward déjà vers `localhost:3000/api/webhooks/stripe`. Déclencher :
```bash
stripe trigger charge.dispute.created
```
Expected : dans le journal `stripe listen`, `[200] POST …/api/webhooks/stripe` pour l'event `charge.dispute.created` (et les `charge.dispute.updated` éventuellement générés par la fixture renvoient aussi `[200]`). Le handler ne doit jamais renvoyer 4xx/5xx.

> Note : `stripe trigger charge.dispute.closed` n'est pas toujours fourni comme fixture autonome ; la clôture peut se tester depuis le dashboard Stripe (résoudre un litige test). La logique étant identique à `updated`, le cas `closed` est couvert par la même branche.

- [ ] **Step 4 : Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhooks): rafraîchit disputes.status sur dispute.updated/closed"
```

- [ ] **Step 5 : (Config — hors code) Cocher les events sur l'endpoint webhook**

Dans le dashboard Stripe (test ET, au passage en live, sur le compte live), ajouter à l'endpoint `…/api/webhooks/stripe` les events `charge.dispute.updated` et `charge.dispute.closed` (en plus des 8 existants). Sans ça, l'endpoint déployé ne recevra pas ces events (le Stripe CLI local les forward de toute façon).

---

## Task 3 : Page `/admin/disputes`

**Files:**
- Create: `src/app/admin/disputes/page.tsx`

- [ ] **Step 1 : Écrire la page (liste lecture seule, style calqué sur `/admin/orders`)**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ExternalLink } from 'lucide-react';
import { Avatar } from '@/components/admin/ui/Avatar';
import { EntityCard } from '@/components/admin/ui/EntityCard';
import { shortOrderHash } from '@/lib/orderNumber';

interface DisputeOrder {
  id: string;
  order_number: number | null;
  total_amount: string;
  status: string;
  profile?: { email?: string | null; full_name?: string | null } | null;
}
interface Dispute {
  id: string;
  stripe_dispute_id: string;
  stripe_charge_id: string;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  created_at: string;
  order: DisputeOrder | null;
}

// Libellés FR des raisons Stripe (fallback = valeur brute).
const REASON_LABELS: Record<string, string> = {
  fraudulent: 'Frauduleux',
  product_not_received: 'Produit non reçu',
  product_unacceptable: 'Produit non conforme',
  duplicate: 'Doublon',
  credit_not_processed: 'Avoir non traité',
  subscription_canceled: 'Abonnement annulé',
  unrecognized: 'Non reconnu',
  general: 'Général',
  customer_initiated: 'Initié par le client',
};
// Libellés + couleurs des statuts de litige Stripe.
const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  warning_needs_response: { label: 'Alerte — à répondre', bg: '#fef3c7', fg: '#b45309' },
  warning_under_review: { label: 'Alerte — en examen', bg: '#fef3c7', fg: '#b45309' },
  warning_closed: { label: 'Alerte close', bg: '#e2e8f0', fg: '#475569' },
  needs_response: { label: 'À répondre', bg: '#fee2e2', fg: '#b91c1c' },
  under_review: { label: 'En examen', bg: '#dbeafe', fg: '#1d4ed8' },
  won: { label: 'Gagné', bg: '#dcfce7', fg: '#15803d' },
  lost: { label: 'Perdu', bg: '#fee2e2', fg: '#b91c1c' },
  charge_refunded: { label: 'Remboursé', bg: '#e2e8f0', fg: '#475569' },
};

function reasonLabel(r: string): string {
  return REASON_LABELS[r] || r.replace(/_/g, ' ');
}
function statusMeta(s: string) {
  return STATUS_META[s] || { label: s.replace(/_/g, ' '), bg: '#e2e8f0', fg: '#475569' };
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch('/api/admin/disputes');
      const data = await res.json();
      setDisputes(data.disputes || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', marginBottom: 4 }}>Litiges</h1>
        <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
          {disputes.length} litige{disputes.length > 1 ? 's' : ''} — les preuves se soumettent dans le dashboard Stripe
        </p>
      </div>

      {loading ? (
        <div className="admin-empty">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : disputes.length === 0 ? (
        <div className="admin-empty">Aucun litige</div>
      ) : (
        <div className="admin-card-grid">
          {disputes.map(d => {
            const sm = statusMeta(d.status);
            const clickable = !!d.order;
            return (
              <EntityCard
                key={d.id}
                onClick={clickable ? () => router.push(`/admin/orders/${d.order!.id}`) : undefined}
                padding={20}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 500, color: '#0f172a', fontSize: '1.05rem', lineHeight: 1.2 }}>
                      {reasonLabel(d.reason)}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#a8b3c2', marginTop: 2 }}>
                      {d.stripe_dispute_id}
                    </div>
                  </div>
                  <span style={{
                    background: sm.bg, color: sm.fg, fontSize: '0.72rem', fontWeight: 600,
                    padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
                  }}>{sm.label}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Avatar name={d.order?.profile?.full_name} email={d.order?.profile?.email} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.order?.profile?.full_name || (d.order ? 'Client' : 'Commande inconnue')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.order?.profile?.email || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '0.5px solid #e2e8f0', paddingTop: 14 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 500, color: '#0f172a' }}>
                    {parseFloat(d.amount).toFixed(2)} {d.currency?.toUpperCase() || 'EUR'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    {d.order && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                        <ExternalLink className="w-3 h-3" />
                        {d.order.order_number != null ? `n°${d.order.order_number}` : `#${shortOrderHash(d.order.id)}`}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: '#94a3b8' }}>
                      <Calendar className="w-3 h-3" />
                      {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </EntityCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier le rendu**

Connecté en admin, ouvrir `http://localhost:3000/admin/disputes`.
Expected : la page liste le(s) litige(s). Le litige existant `du_1TOtoj…` (order_id null) s'affiche avec « Commande inconnue » et **n'est pas cliquable**. Après un `stripe trigger charge.dispute.created` rattaché à une vraie commande, la carte est cliquable et mène à `/admin/orders/[id]`.

- [ ] **Step 3 : Commit**

```bash
git add src/app/admin/disputes/page.tsx
git commit -m "feat(admin): page Litiges en lecture seule"
```

---

## Task 4 : Entrée sidebar « Litiges »

**Files:**
- Modify: `src/app/admin/layout.tsx` (import d'icône + `navItems`)

- [ ] **Step 1 : Ajouter l'icône `Gavel` à l'import lucide-react**

Dans le bloc `import { … } from 'lucide-react';` (lignes 7-18), ajouter `Gavel,` à la liste (par ex. après `ShieldAlert,`).

- [ ] **Step 2 : Ajouter l'entrée de nav**

Dans `navItems` (lignes 20-27), ajouter après la ligne Blocklist :
```typescript
  { href: '/admin/disputes', label: 'Litiges', icon: Gavel, badgeKey: null },
```

- [ ] **Step 3 : Vérifier**

Run:
```bash
npm run lint
```
Expected : pas d'erreur. Puis dans le navigateur admin, « Litiges » apparaît dans la sidebar et mène à `/admin/disputes`.

- [ ] **Step 4 : Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(admin): entrée sidebar Litiges"
```

---

## Self-Review (effectué)

- **Couverture spec** : API liste (Task 1), refresh statut webhook option b (Task 2), page lecture seule + libellés FR + lien vers détail commande + gestion order_id null (Task 3), sidebar sans badge (Task 4). ✅
- **Pas de placeholder** : tout le code est fourni in extenso.
- **Cohérence des types** : `Dispute`/`DisputeOrder` (page) alignés sur le `select` de l'API ; `disputes.status` mis à jour par `stripe_dispute_id` (clé présente dans le schéma). Pas de colonne `updated_at` → on ne l'écrit pas.
- **Config** : Step 2.5 rappelle de cocher les 2 nouveaux events sur l'endpoint déployé.
