import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info';
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

// Toast global storefront (aucune dépendance externe). Appelable depuis un
// composant (useToast) OU un store (useToast.getState().show(...)), ce qui permet
// à useCart.addItem de remonter une erreur visible sans passer par chaque appelant.
export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    // Auto-dismiss après 3,5 s (setTimeout côté client uniquement).
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 3500);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
