import { create } from 'zustand';
import { cartApi } from '../api';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    images: { url: string }[];
    slug: string;
  };
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  isLoading: boolean;
  fetchCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  itemCount: 0,
  isLoading: false,

  fetchCart: async () => {
    try {
      set({ isLoading: true });
      const data = await cartApi.getCart();
      set({ items: data.items, subtotal: data.subtotal, itemCount: data.itemCount });
    } catch {
      // Chưa login — giỏ trống
      set({ items: [], subtotal: 0, itemCount: 0 });
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId, quantity = 1, variantId) => {
    try {
      await cartApi.addItem({ productId, quantity, variantId });
      toast.success('Đã thêm vào giỏ hàng');
      get().fetchCart();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể thêm sản phẩm');
    }
  },

  updateQuantity: async (itemId, quantity) => {
    try {
      await cartApi.updateQuantity(itemId, quantity);
      get().fetchCart();
    } catch {
      toast.error('Cập nhật thất bại');
    }
  },

  removeItem: async (itemId) => {
    try {
      await cartApi.removeItem(itemId);
      toast.success('Đã xóa khỏi giỏ hàng');
      get().fetchCart();
    } catch {
      toast.error('Xóa thất bại');
    }
  },

  clearCart: async () => {
    try {
      await cartApi.clearCart();
      set({ items: [], subtotal: 0, itemCount: 0 });
    } catch {
      toast.error('Không thể xóa giỏ hàng');
    }
  },
}));
