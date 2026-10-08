'use client';

import { useEffect, useRef, useState } from 'react';

// Courbe du back-office : une seule couleur, aire légère, période d'avant en
// pointillés gris (optionnelle), valeur au survol ou au doigt. Le dessin suit
// la largeur réelle pour que les textes gardent leur taille sur téléphone.

export interface LinePoint { label: string; long: string; value: number }

export function LineChart({
  points, previous, format, ariaLabel, height = 200, highlightLast = true, lastSuffix,
}: {
  points: LinePoint[];
  previous?: number[];
  format: (n: number) => string;
  ariaLabel: string;
  height?: number;
  highlightLast?: boolean;
  lastSuffix?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  if (n === 0) return null;
  const H = W < 480 ? Math.min(height, 170) : height;
  const pl = 46, pr = 14, pb = 26, pt = 14;
  const raw = Math.max(1, ...points.map((p) => p.value), ...(previous ?? []));
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => raw / s <= 4) ?? mag * 10;
  const top = Math.ceil(raw / step) * step;
  const x = (i: number) => pl + ((W - pl - pr) * i) / Math.max(1, n - 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const pathOf = (vals: number[]) => {
    const pts = vals.map((v, i) => [x(i), y(v)] as const);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const t = n > 14 ? 0.12 : 0.18;
      const c1y = Math.min(y(0), p1[1] + (p2[1] - p0[1]) * t);
      const c2y = Math.min(y(0), p2[1] - (p3[1] - p1[1]) * t);
      d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const vals = points.map((p) => p.value);
  const line = pathOf(vals);
  const area = `${line} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const every = Math.max(1, Math.ceil(n / (W < 480 ? 4 : 7)));
  const last = n - 1;
  const gid = `lc-${ariaLabel.length}-${n}`;

  return (
    <div className="bo-chart-wrap" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(last, Math.round(((px - pl) / (W - pl - pr)) * last))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.16" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#EEF1F6" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#5B6478">{format(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (i % every === 0 || i === last) && (i === last || last - i >= every / 2) ? (
          <text key={i} x={x(i)} y={H - 7} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="11" fill="#5B6478">{p.label}</text>
        ) : null)}
        {previous && previous.length === n && (
          <path d={pathOf(previous)} fill="none" stroke="#C3CAD6" strokeWidth="1.6" strokeDasharray="4 4" />
        )}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={y(0)} stroke="#C7D2E5" strokeDasharray="3 3" />}
        {n <= 14 && vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === hover || (highlightLast && i === last) ? 4.5 : 3}
            fill={highlightLast && i === last ? '#2563EB' : '#FFFFFF'} stroke="#2563EB" strokeWidth="2" />
        ))}
        {n > 14 && hover != null && <circle cx={x(hover)} cy={y(vals[hover])} r={4.5} fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />}
        {n > 14 && highlightLast && <circle cx={x(last)} cy={y(vals[last])} r={4} fill="#2563EB" />}
      </svg>
      {hover != null && (
        <div className="bo-chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(vals[hover]) / H) * 100}%` }}>
          {points[hover].long} · <b>{format(vals[hover])}</b>
          {previous && previous.length === n ? <span className="bo-chart-prev"> · avant {format(previous[hover])}</span> : null}
          {hover === last && lastSuffix ? ` ${lastSuffix}` : ''}
        </div>
      )}
    </div>
  );
}
