import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  isOpen: boolean;
  loading: boolean;
  addItem: (product: any) => Promise<void>;
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

      addItem: async (product) => {
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
            return;
          }

          if (res.status === 401) {
            // Invité : panier local (persisté), login exigé seulement au paiement.
            const existing = get().items.find((i) => i.productId === product.id);
            if (existing) {
              set((state) => ({
                items: state.items.map((i) =>
                  i.productId === product.id
                    ? { ...i, quantity: Math.min(i.quantity + 1, i.stock || 99) }
                    : i,
                ),
                isOpen: true,
              }));
              return;
            }
            const localItem = await buildLocalItem(product.id);
            if (localItem) {
              set((state) => ({ items: [...state.items, localItem], isOpen: true }));
            }
          }
        } catch (err) {
          console.error('Error adding to cart:', err);
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

      clearCart: () => set({ items: [] }),
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
      partialize: (state) => ({ items: state.items }),
      // Réhydratation manuelle APRÈS l'hydratation React (cf. AuthContext) :
      // évite tout mismatch SSR/client sur le compteur du header.
      skipHydration: true,
    },
  ),
);
