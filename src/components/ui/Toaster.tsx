'use client';

// Rendu global des toasts (monté une fois dans le layout). Les toasts sont
// poussés via useToast().show(message, type) depuis n'importe où (composant ou store).

import { useToast, type ToastType } from '@/store/useToast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const STYLES: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  error: { bg: '#FEF2F2', border: '#FCA5A5', icon: <AlertCircle className="w-4 h-4 text-[#DC2626]" /> },
  success: { bg: '#F0FDF4', border: '#86EFAC', icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> },
  info: { bg: '#EFF6FF', border: '#93C5FD', icon: <Info className="w-4 h-4 text-[#2563EB]" /> },
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 24, zIndex: 200, display: 'flex', flexDirection: 'column',
        gap: 8, width: 'min(92vw, 380px)', pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10,
              background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
              padding: '11px 14px', boxShadow: '0 10px 30px -12px rgba(15,23,42,0.35)',
            }}
          >
            <span style={{ flexShrink: 0, display: 'flex' }}>{s.icon}</span>
            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500, color: '#0B1437', lineHeight: 1.3 }}>
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
              style={{ flexShrink: 0, color: '#94A3B8', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
