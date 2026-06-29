-- ========================================
-- TEL & CASH — Migration 032
-- Tracking de trafic maison (page_views) — 100 % first-party, RGPD-friendly
-- ========================================
-- Aucune donnée perso : visitor_id/session_id sont des identifiants anonymes
-- générés côté client (localStorage / sessionStorage). On ne stocke JAMAIS
-- d'IP brute — seul un code pays (déduit de l'en-tête edge) est conservé.
-- Les insertions passent par /api/track avec la service role (bypass RLS) ;
-- la lecture se fait via la fonction d'agrégation traffic_stats (admin only).

CREATE TABLE IF NOT EXISTS public.page_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path        TEXT NOT NULL,
  referrer    TEXT,
  visitor_id  TEXT NOT NULL,          -- anonyme, persistant (localStorage)
  session_id  TEXT NOT NULL,          -- anonyme, par session (sessionStorage)
  device      TEXT,                   -- 'mobile' | 'desktop' | 'tablet'
  country     TEXT,                   -- code ISO-2 (ex. 'FR'), jamais l'IP
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les agrégations par période et le top pages (pas de scan lourd).
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views (created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON public.page_views (path, created_at);

-- RLS : table verrouillée. Aucune policy publique → ni anon ni authenticated ne
-- peuvent lire/écrire. Seules la service role (API /api/track + stats admin) et
-- la fonction SECURITY DEFINER ci-dessous y accèdent.
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Fonction d'agrégation unique : tout le « Trafic » du dashboard en 1 appel.
-- Renvoie un JSON (visiteurs uniques courant/précédent, pages vues, sessions,
-- série temporelle zéro-remplie, top pages, sources, devices).
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.traffic_stats(
  p_start      TIMESTAMPTZ,
  p_prev_start TIMESTAMPTZ,
  p_monthly    BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH cur AS (
    SELECT * FROM public.page_views WHERE created_at >= p_start
  ),
  prev AS (
    SELECT * FROM public.page_views
    WHERE created_at >= p_prev_start AND created_at < p_start
  )
  SELECT jsonb_build_object(
    'uniqueVisitors',     (SELECT count(DISTINCT visitor_id) FROM cur),
    'uniqueVisitorsPrev', (SELECT count(DISTINCT visitor_id) FROM prev),
    'pageViews',          (SELECT count(*) FROM cur),
    'sessions',           (SELECT count(DISTINCT session_id) FROM cur),
    -- Série temporelle complète (zéro-remplie) via generate_series côté SQL.
    'series', (
      WITH gs AS (
        SELECT generate_series(
          date_trunc(CASE WHEN p_monthly THEN 'month' ELSE 'day' END, p_start),
          date_trunc(CASE WHEN p_monthly THEN 'month' ELSE 'day' END, now()),
          CASE WHEN p_monthly THEN interval '1 month' ELSE interval '1 day' END
        ) AS d
      ),
      agg AS (
        SELECT date_trunc(CASE WHEN p_monthly THEN 'month' ELSE 'day' END, created_at) AS dd,
               count(*) AS cnt
        FROM cur GROUP BY 1
      )
      SELECT coalesce(
        jsonb_agg(jsonb_build_object('date', gs.d::date, 'total', coalesce(agg.cnt, 0)) ORDER BY gs.d),
        '[]'::jsonb
      )
      FROM gs LEFT JOIN agg ON agg.dd = gs.d
    ),
    -- Top 10 pages les plus vues.
    'topPages', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (SELECT path, count(*) AS c FROM cur GROUP BY path ORDER BY c DESC LIMIT 10) t
    ),
    -- Sources de trafic (par session, classées sur le referrer).
    'sources', (
      SELECT jsonb_build_object(
        'direct', count(DISTINCT session_id) FILTER (WHERE referrer IS NULL OR referrer = ''),
        'google', count(DISTINCT session_id) FILTER (WHERE referrer ILIKE '%google.%'),
        'social', count(DISTINCT session_id) FILTER (WHERE referrer ~* '(facebook|instagram|twitter|x\.com|tiktok|linkedin|youtube|pinterest|snapchat|t\.co)'),
        'other',  count(DISTINCT session_id) FILTER (
          WHERE referrer IS NOT NULL AND referrer <> ''
            AND referrer NOT ILIKE '%google.%'
            AND referrer !~* '(facebook|instagram|twitter|x\.com|tiktok|linkedin|youtube|pinterest|snapchat|t\.co)'
        )
      )
      FROM cur
    ),
    -- Répartition par device (par visiteur unique).
    'devices', (
      SELECT jsonb_build_object(
        'mobile',  count(DISTINCT visitor_id) FILTER (WHERE device = 'mobile'),
        'desktop', count(DISTINCT visitor_id) FILTER (WHERE device = 'desktop'),
        'tablet',  count(DISTINCT visitor_id) FILTER (WHERE device = 'tablet'),
        'unknown', count(DISTINCT visitor_id) FILTER (WHERE device IS NULL OR device NOT IN ('mobile','desktop','tablet'))
      )
      FROM cur
    )
  );
$$;

COMMENT ON FUNCTION public.traffic_stats IS
  'Agrégats de trafic (page_views) sur [p_start, now] + visiteurs uniques de la période précédente. Appelée par /api/admin/stats/detailed (admin only).';
