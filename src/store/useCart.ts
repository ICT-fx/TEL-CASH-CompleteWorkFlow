import { create } from 'zustand';

export interface CartItem {
  id: string;
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
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  syncFromServer: (serverItems: any[]) => void;
}

export const useCart = create<CartStore>((set) => ({
  items: [],
  isOpen: false,
  addItem: (item) => set((state) => {
    const existingItem = state.items.find(i => i.id === item.id);
    if (existingItem) {
      return {
        items: state.items.map(i => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
        isOpen: true,
      };
    }
    return { items: [...state.items, { ...item, quantity: 1 }], isOpen: true };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id)
  })),
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, quantity } : i)
  })),
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
