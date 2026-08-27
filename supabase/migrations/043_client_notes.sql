-- Notes internes partagées entre admins sur la fiche client.
-- Remplace le textarea non fonctionnel de admin/clients/[id] ("La sauvegarde
-- des notes sera disponible prochainement") par un vrai fil de notes
-- horodatées, chacune attribuée à l'admin qui l'a écrite — tous les comptes
-- admin (le patron, Edouard le commerçant, etc.) voient et ajoutent au même
-- fil pour un client donné.

CREATE TABLE public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client ON public.client_notes(client_id, created_at DESC);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client notes"
  ON public.client_notes FOR ALL
  USING (public.is_admin());
