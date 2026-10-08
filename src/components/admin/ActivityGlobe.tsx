'use client';

import { useEffect, useRef } from 'react';
import { SHOP_LONLAT } from '@/lib/admin/geo';

// Globe en points de l'écran Activité (repris de la maquette v4 validée).
// Visiteurs en ligne en vert (placés au centre de leur pays), colis en route en
// arcs dorés depuis la boutique d'Angers. Canvas 2D, sans dépendance.
// Glisser pour tourner ; molette ou boutons pour zoomer sur l'Europe.

export interface GlobeVisitor { name: string; lonlat: [number, number]; n: number }
export interface GlobeParcel { id: string; city: string; lonlat: [number, number]; sub: string }

const D = Math.PI / 180;
const TAU = Math.PI * 2;
type Dots = { x: Float32Array; y: Float32Array; z: Float32Array; fr: Uint8Array; n: number };

function decode(b64: string): Dots {
  const s = atob(b64);
  const n = s.length >> 2;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), fr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let a = s.charCodeAt(4 * i) | (s.charCodeAt(4 * i + 1) << 8); if (a > 32767) a -= 65536;
    let b = s.charCodeAt(4 * i + 2) | (s.charCodeAt(4 * i + 3) << 8); if (b > 32767) b -= 65536;
    fr[i] = a & 1;
    const la = ((a - (a & 1)) / 2 / 100) * D, lo = (b / 100) * D, c = Math.cos(la);
    x[i] = c * Math.sin(lo); y[i] = Math.sin(la); z[i] = c * Math.cos(lo);
  }
  return { x, y, z, fr, n };
}
const vec = ([lo, la]: [number, number]): [number, number, number] => {
  const p = la * D, l = lo * D, c = Math.cos(p);
  return [c * Math.sin(l), Math.sin(p), c * Math.cos(l)];
};
function slerp(a: number[], b: number[], t: number): [number, number, number] {
  const d = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), s = Math.sin(d);
  if (s < 1e-6) return [a[0], a[1], a[2]];
  const k1 = Math.sin((1 - t) * d) / s, k2 = Math.sin(t * d) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

const P = {
  body0: '#1A2A57', body1: '#0A1230', rim: 'rgba(130,165,255,.38)', glow: 'rgba(70,120,255,.30)',
  dot: '#4A67AE', fr: '#9DB8FF', arc: '245,184,61', live: '#3CCB7F', txt: '#F2F4F7', txtbg: 'rgba(10,16,32,.78)', shop: '#F5B83D',
};

export function ActivityGlobe({ visitors, parcels, hoverParcel, onHoverParcel }: {
  visitors: GlobeVisitor[];
  parcels: GlobeParcel[];
  hoverParcel: string | null;
  onHoverParcel: (id: string | null) => void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const state = useRef({ visitors, parcels, hoverParcel, onHoverParcel });
  state.current = { visitors, parcels, hoverParcel, onHoverParcel };
  const zoomRef = useRef<(f: number) => void>(() => {});

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let sets: { d: Dots; step: number }[] = [];
    let alive = true;
    fetch('/geo/globe-dots.json').then((r) => r.json()).then((j) => {
      if (!alive) return;
      sets = [{ d: decode(j.GW), step: 0.015 }, { d: decode(j.GE), step: 0.2 * D }];
    }).catch(() => {});

    const A = vec(SHOP_LONLAT);
    let W = 0, H = 0, dpr = 1, R0 = 140;
    // Vue de départ : la France, puisque presque toute l'activité y est.
    const v = { lon: 2.5, lat: 46.5, k: 5.5 };
    let target = { lon: 2.5, lat: 46.5, k: 5.5 };
    let drag: { x: number; y: number; lon: number; lat: number } | null = null;
    let manualUntil = 0, oscT = 0, oscBase = 2.5, last = performance.now(), raf = 0;
    const t0 = performance.now();
    let hits: { x: number; y: number; parcel?: string; label?: string }[] = [];
    const tip = document.createElement('div');
    tip.className = 'bo-globe-tip';
    tip.hidden = true;
    canvas.parentElement?.appendChild(tip);

    const size = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      R0 = Math.max(110, Math.min(W * 0.36, H * 0.43));
    };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    size();

    const rot = (x: number, y: number, z: number): [number, number, number] => {
      const cl = Math.cos(v.lon * D), sl = Math.sin(v.lon * D), cp = Math.cos(v.lat * D), sp = Math.sin(v.lat * D);
      const x1 = x * cl - z * sl, z1 = x * sl + z * cl;
      return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
    };
    let taken: [number, number, number, number][] = [];
    const label = (x: number, y: number, t: string) => {
      g.font = '600 12px Inter, system-ui, sans-serif';
      const w = g.measureText(t).width + 14;
      let lx = x + 10; let ly = y - 11;
      if (lx + w > W - 6) lx = x - 10 - w;
      // Pas d'étiquettes qui se chevauchent : on décale vers le bas, sinon on n'affiche pas.
      for (let tries = 0; tries < 3 && taken.some(([a, b, c, d]) => lx < a + c && lx + w > a && ly < b + d && ly + 22 > b); tries++) ly += 24;
      if (taken.some(([a, b, c, d]) => lx < a + c && lx + w > a && ly < b + d && ly + 22 > b)) return;
      taken.push([lx, ly, w, 22]);
      g.fillStyle = P.txtbg;
      g.beginPath();
      if (g.roundRect) g.roundRect(lx, ly, w, 22, 7); else g.rect(lx, ly, w, 22);
      g.fill();
      g.fillStyle = P.txt;
      g.fillText(t, lx + 7, ly + 15);
    };

    const draw = (now: number) => {
      if (!W) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const R = R0 * v.k, cx = W / 2, cy = H * 0.52;
      const cl = Math.cos(v.lon * D), sl = Math.sin(v.lon * D), cp = Math.cos(v.lat * D), sp = Math.sin(v.lat * D);
      const gr = g.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
      gr.addColorStop(0, P.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 1.28, 0, TAU); g.fill();
      const bd = g.createRadialGradient(cx - R * 0.35, cy - R * 0.42, R * 0.08, cx, cy, R);
      bd.addColorStop(0, P.body0); bd.addColorStop(1, P.body1);
      g.fillStyle = bd; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.strokeStyle = P.rim; g.lineWidth = 1.2; g.stroke();

      const wE = Math.max(0, Math.min(1, (v.k - 1.8) / 1.2));
      sets.forEach((S, si) => {
        const al = si === 0 ? 1 - wE : wE;
        if (al <= 0.01) return;
        const d = S.d;
        const rr = si === 0 ? Math.max(0.9, Math.min(1.6, S.step * R * 0.26)) : Math.max(0.7, Math.min(3.2, S.step * R * 0.3));
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath(); let any = false;
          for (let i = 0; i < d.n; i++) {
            if (d.fr[i] !== pass) continue;
            const x = d.x[i], y = d.y[i], z = d.z[i];
            const x1 = x * cl - z * sl, z1 = x * sl + z * cl, z2 = y * sp + z1 * cp;
            if (z2 <= 0.02) continue;
            const sx = cx + R * x1, sy = cy - R * (y * cp - z1 * sp);
            if (sx < -4 || sy < -4 || sx > W + 4 || sy > H + 4) continue;
            const r = rr * (si === 0 ? 0.55 + 0.45 * z2 : 1);
            g.moveTo(sx + r, sy); g.arc(sx, sy, r, 0, TAU); any = true;
          }
          if (any) { g.fillStyle = pass ? P.fr : P.dot; g.globalAlpha = al * (pass ? 1 : si === 0 ? 0.9 : 0.75); g.fill(); }
        }
        g.globalAlpha = 1;
      });

      hits = [];
      taken = [];
      const T = (now - t0) / 1000;
      const { parcels: ps, visitors: vs, hoverParcel: hp } = state.current;
      ps.forEach((p, ai) => {
        const B = vec(p.lonlat);
        const pts = Array.from({ length: 49 }, (_, i) => {
          const q = rot(...slerp(A, B, i / 48));
          return [cx + R * q[0], cy - R * q[1], q[2] > 0 ? 1 : 0] as [number, number, number];
        });
        const ch = Math.hypot(pts[48][0] - pts[0][0], pts[48][1] - pts[0][1]);
        const L = Math.min(90, 16 + 0.22 * ch);
        const pr = pts.map((q, i) => [q[0], q[1] - L * Math.sin((Math.PI * i) / 48), q[2]] as [number, number, number]);
        const hl = hp === p.id, dim = hp != null && !hl;
        g.lineCap = 'round'; g.lineWidth = hl ? 2.4 : 1.6;
        g.strokeStyle = `rgba(${P.arc},${dim ? 0.12 : hl ? 0.95 : 0.42})`;
        g.beginPath(); let pen = false;
        pr.forEach((q) => { if (q[2]) { if (pen) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); pen = true; } else pen = false; });
        g.stroke();
        const tt = reduce ? 2 : (T / 2.8 + ai * 0.23) % 1.35;
        if (tt <= 1 && !dim) {
          const head = pr[Math.round(tt * 48)];
          if (head[2]) {
            g.fillStyle = `rgba(${P.arc},1)`; g.shadowColor = `rgba(${P.arc},.9)`; g.shadowBlur = 12;
            g.beginPath(); g.arc(head[0], head[1], 2.8, 0, TAU); g.fill(); g.shadowBlur = 0;
          }
        }
        const e = pr[48];
        if (e[2]) {
          g.strokeStyle = `rgba(${P.arc},${dim ? 0.25 : 0.95})`; g.lineWidth = 1.5;
          g.beginPath(); g.arc(e[0], e[1], 3.6, 0, TAU); g.stroke();
          hits.push({ x: e[0], y: e[1], parcel: p.id, label: `${p.city} · ${p.sub}` });
          if (hl) label(e[0], e[1], p.city);
        }
      });
      const s = rot(...A);
      if (s[2] > 0) { g.fillStyle = P.shop; g.beginPath(); g.arc(cx + R * s[0], cy - R * s[1], 3.4, 0, TAU); g.fill(); }
      vs.forEach((o, i) => {
        const q = rot(...vec(o.lonlat));
        if (q[2] <= 0.05) return;
        const x = cx + R * q[0], y = cy - R * q[1];
        const ph = reduce ? 0 : (T * 0.55 + i * 0.37) % 1;
        g.strokeStyle = P.live; g.globalAlpha = (1 - ph) * 0.8; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 4 + ph * 16, 0, TAU); g.stroke(); g.globalAlpha = 1;
        g.fillStyle = P.live; g.beginPath(); g.arc(x, y, 4 + Math.min(3, o.n - 1), 0, TAU); g.fill();
        g.strokeStyle = '#0A1020'; g.lineWidth = 1.5; g.stroke();
        label(x, y, `${o.name} · ${o.n} en ligne`);
        hits.push({ x, y, label: `${o.name} · ${o.n} en ligne` });
      });
    };

    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      if (!drag) {
        if (now > manualUntil && !reduce) { oscT += dt; target.lon = oscBase + (target.k > 1.5 ? 18 / target.k : 18) * Math.sin(oscT / 9); }
        v.lon += (target.lon - v.lon) * 0.06;
        v.lat += (target.lat - v.lat) * 0.06;
      }
      v.k += (target.k - v.k) * 0.12;
      if (!document.hidden) draw(now);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame((t) => { last = t; step(t); });

    zoomRef.current = (f: number) => {
      target.k = Math.max(1, Math.min(9, target.k * f));
      if (target.k > 1.5) { oscBase = 2.5; target.lat = 46.5; }
      else { oscBase = -4; target.lat = 30; }
      manualUntil = 0; oscT = 0;
    };

    const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, lon: v.lon, lat: v.lat }; canvas.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag) {
        const R = R0 * v.k;
        v.lon = drag.lon - ((e.clientX - drag.x) / R) * 57.3;
        v.lat = Math.max(-10, Math.min(65, drag.lat + ((e.clientY - drag.y) / R) * 57.3));
        target = { ...target, lon: v.lon, lat: v.lat };
        manualUntil = performance.now() + 6000; oscBase = v.lon; oscT = 0;
        return;
      }
      let best: (typeof hits)[number] | null = null, bd = 16;
      hits.forEach((h) => { const d = Math.hypot(h.x - mx, h.y - my); if (d < bd) { bd = d; best = h; } });
      const b = best as (typeof hits)[number] | null;
      state.current.onHoverParcel(b?.parcel ?? null);
      if (b?.label) { tip.textContent = b.label; tip.style.left = `${b.x}px`; tip.style.top = `${b.y}px`; tip.hidden = false; } else tip.hidden = true;
    };
    const onUp = () => { drag = null; };
    const onLeave = () => { if (!drag) { state.current.onHoverParcel(null); tip.hidden = true; } };
    const onWheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomRef.current(e.deltaY < 0 ? 1.25 : 0.8); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      tip.remove();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="bo-globe">
      <canvas ref={cv} role="img" aria-label={`Globe : ${visitors.reduce((s, v) => s + v.n, 0)} visiteur(s) en ligne, ${parcels.length} colis en route depuis Angers`} />
      <div className="bo-globe-zoom">
        <button type="button" onClick={() => zoomRef.current(1.6)} aria-label="Zoomer sur la France">+</button>
        <button type="button" onClick={() => zoomRef.current(0.6)} aria-label="Dézoomer">−</button>
      </div>
      <p className="bo-globe-hint">Glisse pour faire tourner · Ctrl + molette pour zoomer</p>
    </div>
  );
}
