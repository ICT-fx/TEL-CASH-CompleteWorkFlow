-- 028 — Message d'annulation visible côté client (espace commande)
--
-- Quand un admin annule + rembourse une commande (POST /api/admin/orders/[id]/refund),
-- on veut afficher au client, dans son espace, la RAISON de l'annulation et une
-- preuve Stripe — en plus de l'email. Jusqu'ici la raison n'était stockée que dans
-- `notes` (texte libre horodaté, non destiné au client).
--
-- Ces deux colonnes sont nullables et rétro-compatibles : les commandes annulées
-- avant cette migration n'ont pas de raison structurée (l'historique reste dans `notes`).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS stripe_receipt_url   text;

COMMENT ON COLUMN orders.cancellation_reason IS
  'Message d''annulation rédigé par l''admin, affiché au client dans son espace commande.';
COMMENT ON COLUMN orders.stripe_receipt_url IS
  'URL du reçu Stripe (page hébergée du paiement, reflète le remboursement) — preuve affichée au client.';
