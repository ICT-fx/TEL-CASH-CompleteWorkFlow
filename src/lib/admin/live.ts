// Libellés lisibles pour l'écran Activité (pages vues, provenance).

/** « /products/iphone-13-128go-tres-bon-etat-ab12cd » → « iPhone 13 128go tres bon etat ». */
export function pageLabel(path: string): string {
  const p = path.split('?')[0];
  if (p === '/' || p === '') return 'Accueil';
  if (p.startsWith('/cart')) return 'Panier';
  if (p.startsWith('/checkout')) return 'Paiement';
  const prod = /^\/products\/(.+?)(?:-[0-9a-f]{6})?$/.exec(p);
  if (prod) {
    return prod[1].replace(/-/g, ' ')
      .replace(/^iphone/, 'iPhone').replace(/^galaxy/, 'Galaxy').replace(/^ipad/, 'iPad')
      .replace(/(\d+) ?(go|to)\b/g, (_m, n, u) => `${n} ${u === 'go' ? 'Go' : 'To'}`)
      .replace(/\btres\b/g, 'très').replace(/\betat\b/g, 'état');
  }
  const seg = p.split('/').filter(Boolean).pop() || p;
  const s = decodeURIComponent(seg).replace(/[-_]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function sourceOf(ref: string | null): string {
  if (!ref) return 'Accès direct';
  if (/google\.[a-z.]+\/maps|maps\.google|g\.co\/kgs|maps\.app\.goo\.gl/i.test(ref)) return 'Google Maps';
  if (/google\./i.test(ref)) return 'Google';
  if (/chatgpt|openai|perplexity|claude\.ai|gemini|copilot/i.test(ref)) return 'Une IA (ChatGPT…)';
  if (/instagram/i.test(ref)) return 'Instagram';
  if (/facebook|fb\./i.test(ref)) return 'Facebook';
  if (/tiktok/i.test(ref)) return 'TikTok';
  if (/bing\./i.test(ref)) return 'Bing';
  try { return new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'Autre site'; }
}

