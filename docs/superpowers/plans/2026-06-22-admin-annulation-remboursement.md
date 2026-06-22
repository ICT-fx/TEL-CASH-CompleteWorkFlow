# Annulation + remboursement admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin d'annuler une commande payée non expédiée, en remboursant le client via Stripe d'un bouton et en lui envoyant un email personnalisé expliquant la raison.

**Architecture:** Un endpoint dédié `POST /api/admin/orders/[id]/refund` exécute, côté serveur et de façon idempotente, toute la séquence sensible : remboursement Stripe → passage de la commande en `cancelled` + champs de remboursement → email client (Resend) → webhook Fluxitron `orders/cancel`. Une modale dans la page détail commande ne fait qu'envoyer `{ reason, amount }`. Le handler webhook `charge.refunded` est durci pour ne pas écraser le statut `cancelled`.

**Tech Stack:** Next.js 15 App Router (route handlers), Stripe SDK (`stripe.refunds.create`), Supabase admin client, Resend (via `src/lib/email.ts`), React (client component, modale inline-style).

## Global Constraints

- **Pas de runner de test** dans ce repo → la vérification de chaque tâche = `npx tsc --noEmit --skipLibCheck` (le `npm run lint` est cassé) + contrôle manuel décrit dans la tâche. Aucun test automatisé à écrire.
- **Langue** : tout texte destiné à l'utilisateur (UI, emails, messages d'erreur) en **français**.
- **Statut final d'une annulation admin** = `cancelled` (jamais `refunded`).
- **Statuts éligibles** au remboursement admin : `paid` et `supplier_ordered` uniquement.
- **Montant** : défaut = `total_amount`, ajustable à la baisse, borné `0 < amount ≤ total_amount`.
- **Pas de migration** : `refunded_at`, `refund_amount`, `stripe_refund_id`, `notes` existent déjà.
- **Pas de gestion de stock** dans cette feature.
- **Mail client = best-effort** : un échec Resend ne doit pas faire échouer le remboursement (déjà effectué côté Stripe).
- **Échappement HTML obligatoire** sur la raison saisie librement (injectée dans l'email).
- Client Supabase à utiliser dans l'endpoint : `createAdminClient()` (bypass RLS), comme les autres routes `api/admin/orders`.

**Préliminaire (avant la Task 1) :** créer une branche de travail depuis `main` (le repo a des modifications non committées en cours, ne pas committer sur `main`) :
```bash
git checkout -b feat/admin-annulation-remboursement
```

---

### Task 1: Email client `sendOrderCancelledEmail`

**Files:**
- Modify: `src/lib/email.ts` (ajout en fin de fichier d'un helper `escapeHtml` + d'une fonction exportée)

**Interfaces:**
- Consumes: `sendEmail(to, subject, html)` et `EmailResult` (déjà présents dans `email.ts`).
- Produces:
  ```ts
  export async function sendOrderCancelledEmail(opts: {
    to: string;
    customerName?: string | null;
    orderNumber: string;   // ex. "n°42"
    reason: string;        // message admin, texte brut
    refundAmount: number;  // en €
  }): Promise<EmailResult>
  ```

- [ ] **Step 1: Ajouter le helper d'échappement + la fonction email**

À la fin de `src/lib/email.ts`, ajouter :

```ts
// Échappe le HTML d'un texte saisi librement (raison d'annulation) afin d'éviter
// toute injection dans l'email, puis on convertira les sauts de ligne en <br>.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Email « Commande annulée et remboursée » envoyé au CLIENT par l'admin.
// Contient le message personnalisé (raison) + le montant remboursé.
// La facture/avoir éventuel et le reçu de remboursement sont gérés par Stripe.
export async function sendOrderCancelledEmail(opts: {
  to: string;
  customerName?: string | null;
  orderNumber: string;
  reason: string;
  refundAmount: number;
}): Promise<EmailResult> {
  const name = (opts.customerName || '').trim();
  const reasonHtml = escapeHtml(opts.reason.trim()).replace(/\n/g, '<br>');
  const subject = `Votre commande ${opts.orderNumber} a été annulée et remboursée`;
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0B1437">
    <div style="background:#0B1437;padding:24px;border-radius:16px 16px 0 0;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">TEL <span style="color:#2F6BFF">&amp;</span> CASH</span>
    </div>
    <div style="border:1px solid #eef;border-top:0;padding:28px;border-radius:0 0 16px 16px">
      <h1 style="font-size:20px;margin:0 0 8px">Votre commande ${opts.orderNumber} a été annulée</h1>
      <p style="color:#5A6172;font-size:14px;line-height:1.6">
        Bonjour${name ? ` ${name}` : ''}, nous avons dû annuler votre commande
        <strong>${opts.orderNumber}</strong> et vous rembourser intégralement.
      </p>
      <div style="background:#F7F9FF;border:1px solid #E7EAF1;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6B7A99;font-weight:700">Message de l'équipe</p>
        <p style="margin:0;font-size:14px;color:#0B1437;line-height:1.6">${reasonHtml}</p>
      </div>
      <div style="background:#F2FBF5;border:1px solid #CDEBD6;border-radius:12px;padding:16px;margin:18px 0">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#3B8C5A;font-weight:700">Montant remboursé</p>
        <p style="margin:0;font-size:18px;font-weight:800;color:#1B6E3B">${eur(opts.refundAmount)}</p>
      </div>
      <p style="color:#5A6172;font-size:13px;line-height:1.6">
        Le remboursement apparaîtra sur votre moyen de paiement sous <strong>5 à 10 jours ouvrés</strong>.
        Stripe vous envoie également un reçu de remboursement par email.
      </p>
      <p style="color:#9AA3B2;font-size:12px;line-height:1.6;margin-top:22px">
        Toutes nos excuses pour la gêne occasionnée. Une question ? Répondez à cet email
        ou écrivez-nous à contact@telandcash.fr.
      </p>
    </div>
  </div>`;
  return sendEmail(opts.to, subject, html);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur (ou seulement des erreurs préexistantes sans rapport avec `email.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): mail client annulation + remboursement personnalisé"
```

---

### Task 2: Endpoint `POST /api/admin/orders/[id]/refund`

**Files:**
- Create: `src/app/api/admin/orders/[id]/refund/route.ts`

**Interfaces:**
- Consumes:
  - `requireAdmin()` → `{ profile, response }` ; `profile.id` = id admin.
  - `createAdminClient()` (Supabase, bypass RLS).
  - `stripe.refunds.create(...)`.
  - `buildOrderNumberMap(orders)` depuis `@/lib/orderNumber` → `Map<id, number>`.
  - `sendOrderCancelledEmail(...)` (Task 1).
  - `sendFluxitronWebhook({ topic, data })` + `toFluxitronOrder(order, items)`.
- Produces (contrat HTTP consommé par la modale, Task 4) :
  - Succès `200` : `{ ok: true, refundId: string, status: 'cancelled', emailSent: boolean }`
  - Erreurs : `{ error: string }` avec status `400` / `404` / `409` / `502` / `500`.

- [ ] **Step 1: Créer le fichier route avec toute la logique**

Créer `src/app/api/admin/orders/[id]/refund/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { buildOrderNumberMap } from '@/lib/orderNumber';
import { sendOrderCancelledEmail } from '@/lib/email';
import { sendFluxitronWebhook } from '@/lib/fluxitron-webhook';
import { toFluxitronOrder } from '@/app/api/v1/_lib/mappers';

// Statuts depuis lesquels un admin peut annuler + rembourser (avant expédition).
const CANCELLABLE = ['paid', 'supplier_ordered'];

// POST /api/admin/orders/[id]/refund — Annule la commande + rembourse via Stripe.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { profile, response } = await requireAdmin();
    if (response) return response;

    const body = await request.json().catch(() => ({} as any));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json(
        { error: 'Le message au client (raison) est obligatoire.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, profile:profiles(email, full_name)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    // ── Garde-fous ────────────────────────────────────────────────────────
    if (!CANCELLABLE.includes(order.status)) {
      return NextResponse.json(
        { error: 'Cette commande ne peut plus être annulée à ce stade.' },
        { status: 409 }
      );
    }
    if (order.refunded_at || order.stripe_refund_id) {
      return NextResponse.json({ error: 'Commande déjà remboursée.' }, { status: 409 });
    }
    if (!order.stripe_payment_intent) {
      return NextResponse.json(
        { error: 'Paiement non capturé — remboursement impossible.' },
        { status: 400 }
      );
    }

    const total = parseFloat(order.total_amount || '0');
    const amount =
      body.amount === undefined || body.amount === null ? total : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > total + 0.001) {
      return NextResponse.json(
        { error: `Montant invalide (entre 0,01 € et ${total.toFixed(2)} €).` },
        { status: 400 }
      );
    }
    const cents = Math.round(amount * 100);

    // ── Remboursement Stripe (avant toute mutation de la commande) ────────
    let refund: { id: string };
    try {
      refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent,
        amount: cents,
        reason: 'requested_by_customer',
        metadata: { order_id: order.id, admin_id: profile.id },
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: `Échec du remboursement Stripe : ${e?.message || 'erreur inconnue'}` },
        { status: 502 }
      );
    }

    // ── Mise à jour de la commande ────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const stamp = new Date().toLocaleString('fr-FR');
    const noteLine = `[${stamp}] Annulée + remboursée (${amount.toFixed(2)} €) — ${reason}`;
    const newNotes = order.notes ? `${order.notes}\n${noteLine}` : noteLine;

    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        stripe_refund_id: refund.id,
        refund_amount: amount,
        refunded_at: nowIso,
        notes: newNotes,
      })
      .eq('id', order.id);

    // Numéro de commande lisible (n°1, n°2…) pour l'email.
    const { data: allOrders } = await supabase.from('orders').select('id, created_at');
    const num = buildOrderNumberMap(allOrders || []).get(order.id);
    const orderNumber = num != null ? `n°${num}` : `#${order.id.slice(0, 8)}`;

    // ── Email client (best-effort) ────────────────────────────────────────
    let emailSent = false;
    const customerEmail = (order as any).profile?.email || null;
    if (customerEmail) {
      const r = await sendOrderCancelledEmail({
        to: customerEmail,
        customerName: (order as any).profile?.full_name,
        orderNumber,
        reason,
        refundAmount: amount,
      });
      emailSent = r.sent;
      if (!r.sent) console.error('[refund] email non envoyé:', r.reason);
    }

    // ── Webhook Fluxitron orders/cancel (fire-and-forget) ─────────────────
    try {
      const { data: cancelledOrder } = await supabase
        .from('orders').select('*').eq('id', order.id).single();
      const { data: cancelledItems } = await supabase
        .from('order_items')
        .select('*, product:products(brand, model, sku, images)')
        .eq('order_id', order.id);
      if (cancelledOrder) {
        await sendFluxitronWebhook({
          topic: 'orders/cancel',
          data: toFluxitronOrder(cancelledOrder, cancelledItems || []),
        });
      }
    } catch (webhookErr) {
      console.error('Fluxitron webhook error:', webhookErr);
    }

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      status: 'cancelled',
      emailSent,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur liée à `refund/route.ts`. En cas d'erreur sur `toFluxitronOrder`, vérifier sa signature dans `src/app/api/v1/_lib/mappers.ts:845` et passer `(order, items)`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/orders/[id]/refund/route.ts
git commit -m "feat(admin): endpoint annulation + remboursement Stripe"
```

---

### Task 3: Durcir le webhook `charge.refunded`

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts:383-403`

**Interfaces:**
- Consumes: rien de nouveau. Modifie le handler `case 'charge.refunded'`.
- Produces: rien (effet de bord : ne plus écraser `cancelled`/`refunded`).

- [ ] **Step 1: Ajouter la garde de statut**

Dans `src/app/api/webhooks/stripe/route.ts`, remplacer le bloc actuel :

```ts
        if (paymentIntentId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent', paymentIntentId)
            .maybeSingle();

          if (order) {
            await supabase
              .from('orders')
              .update({ status: 'refunded' })
              .eq('id', order.id);
            console.log(`💸 Order ${order.id} refunded`);
          }
        }
```

par :

```ts
        if (paymentIntentId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id, status')
            .eq('stripe_payment_intent', paymentIntentId)
            .maybeSingle();

          // Ne pas écraser une annulation admin (cancelled) ni un état déjà
          // remboursé. Couvre encore les remboursements faits depuis le
          // dashboard Stripe sur une commande non annulée.
          if (order && order.status !== 'cancelled' && order.status !== 'refunded') {
            await supabase
              .from('orders')
              .update({ status: 'refunded' })
              .eq('id', order.id);
            console.log(`💸 Order ${order.id} refunded`);
          }
        }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur liée à `webhooks/stripe/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "fix(webhook): charge.refunded n'écrase plus le statut cancelled"
```

---

### Task 4: Bouton + modale dans la page détail commande

**Files:**
- Modify: `src/app/admin/orders/[id]/page.tsx` (état, bouton header, bloc modale, composant `RefundModal`)

**Interfaces:**
- Consumes: `POST /api/admin/orders/[id]/refund` (Task 2) ; `showToast`, `load`, `id`, `order`, `updating` déjà en scope ; `XCircle` déjà importé (ligne 8) ; classe CSS `admin-btn-danger` (déjà définie dans `globals.css`).
- Produces: rien (UI terminale).

- [ ] **Step 1: Ajouter l'état de la modale**

Dans `src/app/admin/orders/[id]/page.tsx`, après la ligne `const [showShipModal, setShowShipModal] = useState(false);` (≈ ligne 87), ajouter :

```tsx
  const [showRefundModal, setShowRefundModal] = useState(false);
```

- [ ] **Step 2: Ajouter le bouton dans la barre d'actions du header**

Dans la barre d'actions (`<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>`, ≈ ligne 260), juste après le bouton « Expédier » et avant le bouton « Marquer comme livrée », ajouter :

```tsx
            {(order.status === 'paid' || order.status === 'supplier_ordered') && (
              <button className="admin-btn admin-btn-danger" disabled={updating}
                onClick={() => setShowRefundModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle className="w-4 h-4" /> Annuler + rembourser
              </button>
            )}
```

- [ ] **Step 3: Ajouter le bloc d'instanciation de la modale**

Juste avant le bloc `{showShipModal && (` (≈ ligne 500), ajouter :

```tsx
      {showRefundModal && order && (
        <RefundModal
          total={parseFloat(order.total_amount || '0')}
          onClose={() => setShowRefundModal(false)}
          onConfirm={async ({ reason, amount }) => {
            const res = await fetch(`/api/admin/orders/${id}/refund`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason, amount }),
            });
            const data = await res.json();
            if (!res.ok) {
              showToast(data.error || 'Erreur lors du remboursement');
              return false;
            }
            setShowRefundModal(false);
            await load();
            showToast(
              data.emailSent
                ? 'Commande annulée et remboursée — client prévenu par email'
                : 'Commande annulée et remboursée (email client non envoyé)'
            );
            return true;
          }}
        />
      )}
```

- [ ] **Step 4: Ajouter le composant `RefundModal`**

À la fin du fichier, après le composant `ShipModal` (au même niveau, fonction de module), ajouter :

```tsx
// =====================================================================
// REFUND MODAL — message au client + montant, déclenche annulation + remboursement.
// =====================================================================
function RefundModal({
  total, onClose, onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: (payload: { reason: string; amount: number }) => Promise<boolean>;
}) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(total.toFixed(2));
  const [submitting, setSubmitting] = useState(false);

  const amountNum = parseFloat(amount.replace(',', '.'));
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= total + 0.001;
  const canSubmit = reason.trim().length > 0 && amountValid && !submitting;
  const totalFr = total.toFixed(2).replace('.', ',');

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onConfirm({ reason: reason.trim(), amount: amountNum });
    if (!ok) setSubmitting(false); // échec → garder la modale ouverte
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'white', borderRadius: 16, maxWidth: 520, width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: 22, borderBottom: '0.5px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>Annuler &amp; rembourser la commande</h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>
            Le client est remboursé immédiatement via Stripe et reçoit un email avec votre message. Action irréversible.
          </p>
        </div>

        <div style={{ padding: 22 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', display: 'block', marginBottom: 6 }}>
            Message au client (raison) *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Bonjour, nous sommes désolés mais le produit commandé n'est finalement plus disponible…"
            className="admin-form-input"
            style={{ width: '100%', resize: 'vertical' }}
          />

          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', display: 'block', margin: '16px 0 6px' }}>
            Montant à rembourser (€) *
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="admin-form-input"
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
            Total payé (frais de port inclus) : {totalFr} €. Vous pouvez rembourser moins.
          </p>
          {amount.trim() !== '' && !amountValid && (
            <p style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: 6 }}>
              Le montant doit être compris entre 0,01 € et {totalFr} €.
            </p>
          )}
        </div>

        <div style={{ padding: 22, borderTop: '0.5px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="admin-btn"
            style={{
              background: canSubmit ? '#dc2626' : '#fca5a5',
              color: '#fff', cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting
              ? 'Remboursement…'
              : `Confirmer le remboursement de ${amountValid ? amountNum.toFixed(2).replace('.', ',') : '—'} €`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: aucune erreur liée à `page.tsx`.

- [ ] **Step 6: Vérification manuelle end-to-end (Stripe mode test)**

Démarrer l'app (`npm run dev`) et, en mode test Stripe :
1. Créer/ouvrir une commande au statut `paid` (route `test-order` existante ou commande réelle de test).
2. Sur `/admin/orders/<id>`, vérifier que le bouton **« Annuler + rembourser »** apparaît (et n'apparaît PAS sur une commande `shipped`/`delivered`).
3. Cliquer → la modale s'ouvre. Vérifier : bouton de confirmation désactivé tant que le message est vide ; message d'erreur si montant > total.
4. Saisir une raison + garder le montant total → confirmer.
5. Vérifier : toast de succès ; la commande passe en `cancelled` ; le bouton disparaît.
6. Dans le **dashboard Stripe (test)** : le remboursement apparaît sur le PaymentIntent.
7. En base (`orders`) : `status='cancelled'`, `refund_amount`, `refunded_at`, `stripe_refund_id` remplis, note horodatée ajoutée à `notes`.
8. Vérifier la réception de l'**email Resend** personnalisé (si `RESEND_API_KEY` configurée) contenant la raison + le montant.
9. Vérifier qu'à l'arrivée du webhook `charge.refunded`, la commande **reste** `cancelled` (ne bascule pas en `refunded`).
10. Refaire un POST sur la même commande → réponse `409 « Commande déjà remboursée »` (idempotence).
11. Tester un montant partiel (< total) sur une autre commande test → remboursement partiel correct côté Stripe.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/orders/[id]/page.tsx
git commit -m "feat(admin): bouton + modale annulation/remboursement commande"
```

---

## Self-Review (auteur du plan)

**Spec coverage :**
- Annuler dès « payé » → Task 4 bouton conditionné `paid`/`supplier_ordered` + Task 2 garde `CANCELLABLE`. ✅
- Message personnalisé au client → Task 4 textarea obligatoire → Task 2 `reason` requis → Task 1 email. ✅
- Bouton de remboursement → Task 2 `stripe.refunds.create`. ✅
- Email personnalisé au client → Task 1 `sendOrderCancelledEmail` (raison + montant, échappée). ✅
- Montant total ajustable → Task 4 input + Task 2 validation `0 < amount ≤ total`. ✅
- Statut final `cancelled` → Task 2 `update status:'cancelled'` + Task 3 garde webhook. ✅
- Pas de stock, pas de migration → respecté (aucune tâche n'y touche). ✅

**Placeholder scan :** aucun TBD/TODO ; chaque step de code contient le code complet.

**Type consistency :** `sendOrderCancelledEmail` (opts identiques Task 1 ↔ Task 2) ; contrat HTTP `{ ok, refundId, status, emailSent }` (Task 2 ↔ Task 4) ; `onConfirm: (payload) => Promise<boolean>` cohérent entre l'instanciation (Step 3) et le composant (Step 4) ; `total: number` passé en prop. ✅
