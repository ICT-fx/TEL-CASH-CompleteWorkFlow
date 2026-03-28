import { create } from 'zustand';

export interface CartItem {
  id: string; // This is the cart_item ID from DB
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  storage: string;
  grade: string;
  color: string;
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
}

export const useCart = create<CartStore>((set, get) => ({
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
          const existingItem = state.items.find(i => i.productId === product.id);
          if (existingItem) {
            return {
              items: state.items.map(i => 
                i.productId === product.id ? { ...i, quantity: newItem.quantity } : i
              ),
              isOpen: true,
            };
          }
          
          const formattedItem: CartItem = {
            id: newItem.id,
            productId: newItem.product_id,
            name: `${newItem.product?.brand || ''} ${newItem.product?.model || ''}`.trim(),
            price: parseFloat(newItem.product?.price || 0),
            image: newItem.product?.images?.[0] || '',
            quantity: newItem.quantity,
            storage: newItem.product?.storage_capacity || '',
            grade: newItem.product?.grade || '',
            color: newItem.product?.color || '',
          };
          
          return { items: [...state.items, formattedItem], isOpen: true };
        });
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  },

  removeItem: async (itemId) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      if (res.ok) {
        set((state) => ({
          items: state.items.filter(i => i.id !== itemId)
        }));
      }
    } catch (err) {
      console.error('Error removing from cart:', err);
    }
  },

  updateQuantity: async (itemId, quantity) => {
    if (quantity < 1) return;
    
    try {
      const res = await fetch('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity }),
      });

      if (res.ok) {
        set((state) => ({
          items: state.items.map(i => i.id === itemId ? { ...i, quantity } : i)
        }));
      }
    } catch (err) {
      console.error('Error updating cart quantity:', err);
    }
  },

  clearCart: () => set({ items: [] }),
  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  syncFromServer: (serverItems) => set({
    items: serverItems.map((item: any) => ({
      id: item.id,
      productId: item.product_id,
      name: `${item.product?.brand || ''} ${item.product?.model || ''}`.trim(),
      price: parseFloat(item.product?.price || 0),
      image: item.product?.images?.[0] || '',
      quantity: item.quantity,
      storage: item.product?.storage_capacity || '',
      grade: item.product?.grade || '',
      color: item.product?.color || '',
    }))
  }),
}));
