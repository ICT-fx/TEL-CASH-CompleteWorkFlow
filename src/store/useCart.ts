import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useToast } from '@/store/useToast';

// Résultat typé d'un ajout au panier : succès/échec + raison lisible. Permet à
// l'appelant de NE PAS afficher un faux « Ajouté ✓ » quand l'ajout a échoué.
export interface AddResult {
  ok: boolean;
  reason?: string;
}

export interface CartItem {
  id: string; // cart_item ID serveur, ou `local-<productId>` pour un invité
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  storage: string;
  grade: string;
  color: string;
  stock: number;
}

interface CartStore {
  items: CartItem[];
  promoCode: string | null;
  setPromoCode: (code: string | null) => void;
  isOpen: boolean;
  loading: boolean;
  addItem: (product: any) => Promise<AddResult>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  fetchCart: () => Promise<void>;
  syncFromServer: (serverItems: any[]) => void;
  /** Pousse le panier invité (items `local-*`) vers le serveur après login. */
  mergeLocalCart: () => Promise<void>;
}

const isLocalItem = (id: string) => id.startsWith('local-');

// Sell-to-order : aucun suivi de stock. La quantité par ligne est simplement
// bornée à une valeur raisonnable pour éviter les saisies aberrantes.
export const MAX_CART_QTY = 10;

function formatServerItem(item: any): CartItem {
  return {
    id: item.id,
    productId: item.product_id,
    name: `${item.product?.brand || ''} ${item.product?.model || ''}`.trim(),
    price: parseFloat(item.product?.price || 0),
    image: item.product?.images?.[0] || '',
    quantity: item.quantity,
    storage: item.product?.storage_capacity || '',
    grade: item.product?.grade || '',
    color: item.product?.color || '',
    stock: item.product?.stock || 0,
  };
}

// Panier invité : on récupère la fiche publique du SKU pour construire
// l'item localement (les appelants ne passent parfois que { id }).
async function buildLocalItem(productId: string): Promise<CartItem | null> {
  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const p = data.product || data;
    if (!p?.id) return null;
    return {
      id: `local-${p.id}`,
      productId: p.id,
      name: `${p.brand || ''} ${p.model || ''}`.trim(),
      price: parseFloat(p.price || 0),
      image: p.images?.[0] || '',
      quantity: 1,
      storage: p.storage_capacity || '',
      grade: p.grade || '',
      color: p.color || '',
      stock: p.stock ?? 1,
    };
  } catch {
    return null;
  }
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      setPromoCode: (code) => set({ promoCode: code ? code.toUpperCase() : null }),
      isOpen: false,
      loading: false,

      fetchCart: async () => {
        set({ loading: true });
        try {
          const res = await fetch('/api/cart');
          if (res.ok) {
            const data = await res.json();
            get().syncFromServer(data.items || []);
          }
          // 401 (invité) : on garde le panier local persisté tel quel.
        } catch (err) {
          console.error('Error fetching cart:', err);
        } finally {
          set({ loading: false });
        }
      },

      addItem: async (product): Promise<AddResult> => {
        const fail = (reason: string): AddResult => {
          // Erreur TOUJOURS visible (toast) — plus jamais un clic « qui ne fait rien ».
          useToast.getState().show(reason, 'error');
          return { ok: false, reason };
        };
        try {
          const res = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: product.id, quantity: 1 }),
          });

          if (res.ok) {
            const data = await res.json();
            const newItem = data.item;

            set((state) => {
              const existingItem = state.items.find((i) => i.productId === product.id);
              if (existingItem) {
                return {
                  items: state.items.map((i) =>
                    i.productId === product.id ? { ...i, quantity: newItem.quantity } : i,
                  ),
                  isOpen: true,
                };
              }
              return { items: [...state.items, formatServerItem(newItem)], isOpen: true };
            });
            return { ok: true };
          }

          if (res.status === 401) {
            // Invité : panier local (persisté), le paiement invité reste possible.
            const existing = get().items.find((i) => i.productId === product.id);
            if (existing) {
              set((state) => ({
                items: state.items.map((i) =>
                  i.productId === product.id
                    ? { ...i, quantity: Math.min(i.quantity + 1, MAX_CART_QTY) }
                    : i,
                ),
                isOpen: true,
              }));
              return { ok: true };
            }
            const localItem = await buildLocalItem(product.id);
            if (localItem) {
              set((state) => ({ items: [...state.items, localItem], isOpen: true }));
              return { ok: true };
            }
            // La fiche publique du produit est injoignable → on le signale.
            return fail('Produit momentanément indisponible. Réessayez.');
          }

          // Tous les autres statuts (404 introuvable, 409 indisponible, 500…) :
          // on remonte le message serveur si présent, sinon un message générique.
          let reason = res.status === 404
            ? 'Produit introuvable.'
            : res.status === 409
              ? "Cet article n'est plus disponible à la vente."
              : 'Impossible d’ajouter au panier. Réessayez.';
          try {
            const d = await res.json();
            if (d?.error) reason = d.error;
          } catch { /* pas de corps JSON */ }
          return fail(reason);
        } catch (err) {
          console.error('Error adding to cart:', err);
          return fail('Erreur réseau. Vérifiez votre connexion et réessayez.');
        }
      },

      removeItem: async (itemId) => {
        if (isLocalItem(itemId)) {
          set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
          return;
        }
        try {
          const res = await fetch('/api/cart', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId }),
          });
          if (res.ok) {
            set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
          }
        } catch (err) {
          console.error('Error removing from cart:', err);
        }
      },

      updateQuantity: async (itemId, quantity) => {
        if (quantity < 1) return;
        if (isLocalItem(itemId)) {
          set((state) => ({
            items: state.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
          }));
          return;
        }
        try {
          const res = await fetch('/api/cart', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId, quantity }),
          });
          if (res.ok) {
            set((state) => ({
              items: state.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
            }));
          }
        } catch (err) {
          console.error('Error updating cart quantity:', err);
        }
      },

      mergeLocalCart: async () => {
        const localItems = get().items.filter((i) => isLocalItem(i.id));
        for (const item of localItems) {
          try {
            await fetch('/api/cart', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_id: item.productId, quantity: item.quantity }),
            });
          } catch (err) {
            console.error('Error merging local cart item:', err);
          }
        }
        // Le serveur devient la source de vérité (remplace aussi les items local-*).
        await get().fetchCart();
      },

      clearCart: () => set({ items: [], promoCode: null }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      syncFromServer: (serverItems) =>
        set({ items: serverItems.map(formatServerItem) }),
    }),
    {
      name: 'telcash-cart',
      storage: createJSONStorage(() => localStorage),
      // Seuls les articles sont persistés (pas l'état d'ouverture du drawer).
      partialize: (state) => ({ items: state.items, promoCode: state.promoCode }),
      // Réhydratation manuelle APRÈS l'hydratation React (cf. AuthContext) :
      // évite tout mismatch SSR/client sur le compteur du header.
      skipHydration: true,
    },
  ),
);
