import { act } from '@testing-library/react';
import toast from 'react-hot-toast';
import { cartApi } from '../api';
import { useCart } from './useCart';

jest.mock('../api', () => ({
  cartApi: {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateQuantity: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedCartApi = cartApi as jest.Mocked<typeof cartApi>;
const mockedToast = toast as jest.Mocked<typeof toast>;

const initialState = useCart.getState();

describe('useCart store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCart.setState(initialState, true);
    localStorage.clear();
  });

  describe('fetchCart', () => {
    it('resets the cart without calling the API when there is no access token', async () => {
      await act(async () => {
        await useCart.getState().fetchCart();
      });

      expect(mockedCartApi.getCart).not.toHaveBeenCalled();
      expect(useCart.getState()).toEqual(
        expect.objectContaining({ items: [], subtotal: 0, itemCount: 0 }),
      );
    });

    it('populates the store from the API when logged in', async () => {
      localStorage.setItem('access_token', 'token-123');
      mockedCartApi.getCart.mockResolvedValue({
        items: [{ id: 'item-1' }],
        subtotal: 100000,
        itemCount: 1,
      });

      await act(async () => {
        await useCart.getState().fetchCart();
      });

      expect(useCart.getState().items).toEqual([{ id: 'item-1' }]);
      expect(useCart.getState().subtotal).toBe(100000);
      expect(useCart.getState().itemCount).toBe(1);
      expect(useCart.getState().isLoading).toBe(false);
    });

    it('resets the cart when the API call fails (e.g. expired token)', async () => {
      localStorage.setItem('access_token', 'token-123');
      mockedCartApi.getCart.mockRejectedValue(new Error('Unauthorized'));

      await act(async () => {
        await useCart.getState().fetchCart();
      });

      expect(useCart.getState()).toEqual(
        expect.objectContaining({ items: [], subtotal: 0, itemCount: 0, isLoading: false }),
      );
    });
  });

  describe('addItem', () => {
    it('adds a new product and shows a success toast', async () => {
      mockedCartApi.addItem.mockResolvedValue({});
      mockedCartApi.getCart.mockResolvedValue({ items: [], subtotal: 0, itemCount: 0 });
      localStorage.setItem('access_token', 'token-123');

      await act(async () => {
        await useCart.getState().addItem('product-1', 1);
      });

      expect(mockedCartApi.addItem).toHaveBeenCalledWith({
        productId: 'product-1',
        quantity: 1,
        variantId: undefined,
      });
      expect(mockedToast.success).toHaveBeenCalledWith('Đã thêm vào giỏ hàng');
    });

    it('increments the quantity when the product is already in the cart', async () => {
      useCart.setState({
        items: [
          {
            id: 'item-1',
            productId: 'product-1',
            variantId: undefined,
            quantity: 2,
            product: {
              id: 'product-1',
              name: 'Laptop',
              price: 100000,
              images: [],
              slug: 'laptop',
            },
          },
        ],
      } as any);
      mockedCartApi.updateQuantity.mockResolvedValue({});
      mockedCartApi.getCart.mockResolvedValue({ items: [], subtotal: 0, itemCount: 0 });

      await act(async () => {
        await useCart.getState().addItem('product-1', 3);
      });

      expect(mockedCartApi.updateQuantity).toHaveBeenCalledWith('item-1', 5);
      expect(mockedCartApi.addItem).not.toHaveBeenCalled();
      expect(mockedToast.success).toHaveBeenCalledWith('Đã cập nhật số lượng trong giỏ hàng');
    });

    it('shows an error toast when the API call fails', async () => {
      mockedCartApi.addItem.mockRejectedValue({
        response: { data: { message: 'Sản phẩm đã hết hàng' } },
      });

      await act(async () => {
        await useCart.getState().addItem('product-1', 1);
      });

      expect(mockedToast.error).toHaveBeenCalledWith('Sản phẩm đã hết hàng');
    });
  });

  describe('removeItem', () => {
    it('removes the item and shows a success toast', async () => {
      mockedCartApi.removeItem.mockResolvedValue({});
      mockedCartApi.getCart.mockResolvedValue({ items: [], subtotal: 0, itemCount: 0 });

      await act(async () => {
        await useCart.getState().removeItem('item-1');
      });

      expect(mockedCartApi.removeItem).toHaveBeenCalledWith('item-1');
      expect(mockedToast.success).toHaveBeenCalledWith('Đã xóa khỏi giỏ hàng');
    });

    it('shows an error toast when removal fails', async () => {
      mockedCartApi.removeItem.mockRejectedValue(new Error('network error'));

      await act(async () => {
        await useCart.getState().removeItem('item-1');
      });

      expect(mockedToast.error).toHaveBeenCalledWith('Xóa thất bại');
    });
  });

  describe('clearCart', () => {
    it('resets the store when the API call succeeds', async () => {
      mockedCartApi.clearCart.mockResolvedValue({});

      await act(async () => {
        await useCart.getState().clearCart();
      });

      expect(useCart.getState()).toEqual(
        expect.objectContaining({ items: [], subtotal: 0, itemCount: 0 }),
      );
    });

    it('shows an error toast when the API call fails', async () => {
      mockedCartApi.clearCart.mockRejectedValue(new Error('network error'));

      await act(async () => {
        await useCart.getState().clearCart();
      });

      expect(mockedToast.error).toHaveBeenCalledWith('Không thể xóa giỏ hàng');
    });
  });
});
