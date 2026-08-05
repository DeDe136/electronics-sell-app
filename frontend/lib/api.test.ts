import {
  api,
  authApi,
  cartApi,
  catalogApi,
  orderApi,
  paymentMethodApi,
  userApi,
} from './api';

describe('api wrappers', () => {
  const mockResolvedData = (data: unknown) => Promise.resolve({ data });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('catalogApi', () => {
    it('getProducts calls GET /catalog/products with query params', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData([{ id: '1' }]) as any);

      const result = await catalogApi.getProducts({ page: 1 });

      expect(spy).toHaveBeenCalledWith('/catalog/products', { params: { page: 1 } });
      expect(result).toEqual([{ id: '1' }]);
    });

    it('getProduct calls GET /catalog/products/:slug', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData({ id: '1' }) as any);

      await catalogApi.getProduct('iphone-16');

      expect(spy).toHaveBeenCalledWith('/catalog/products/iphone-16');
    });

    it('getCategories calls GET /catalog/categories', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData([]) as any);

      await catalogApi.getCategories();

      expect(spy).toHaveBeenCalledWith('/catalog/categories');
    });
  });

  describe('cartApi', () => {
    it('getCart calls GET /cart', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData({ items: [] }) as any);

      await cartApi.getCart();

      expect(spy).toHaveBeenCalledWith('/cart');
    });

    it('addItem calls POST /cart/items with the payload', async () => {
      const spy = jest.spyOn(api, 'post').mockReturnValue(mockResolvedData({}) as any);

      await cartApi.addItem({ productId: 'p1', quantity: 2 });

      expect(spy).toHaveBeenCalledWith('/cart/items', { productId: 'p1', quantity: 2 });
    });

    it('updateQuantity calls PATCH /cart/items/:id with the new quantity', async () => {
      const spy = jest.spyOn(api, 'patch').mockReturnValue(mockResolvedData({}) as any);

      await cartApi.updateQuantity('item-1', 5);

      expect(spy).toHaveBeenCalledWith('/cart/items/item-1', { quantity: 5 });
    });

    it('removeItem calls DELETE /cart/items/:id', async () => {
      const spy = jest.spyOn(api, 'delete').mockReturnValue(mockResolvedData({}) as any);

      await cartApi.removeItem('item-1');

      expect(spy).toHaveBeenCalledWith('/cart/items/item-1');
    });

    it('removeItems calls DELETE /cart/items with a list of ids in the body', async () => {
      const spy = jest.spyOn(api, 'delete').mockReturnValue(mockResolvedData({}) as any);

      await cartApi.removeItems(['a', 'b']);

      expect(spy).toHaveBeenCalledWith('/cart/items', { data: { itemIds: ['a', 'b'] } });
    });

    it('clearCart calls DELETE /cart', async () => {
      const spy = jest.spyOn(api, 'delete').mockReturnValue(mockResolvedData({}) as any);

      await cartApi.clearCart();

      expect(spy).toHaveBeenCalledWith('/cart');
    });
  });

  describe('authApi', () => {
    it('login calls POST /auth/login with email and password', async () => {
      const spy = jest.spyOn(api, 'post').mockReturnValue(mockResolvedData({ accessToken: 't' }) as any);

      await authApi.login('user@example.com', 'password123');

      expect(spy).toHaveBeenCalledWith('/auth/login', {
        email: 'user@example.com',
        password: 'password123',
      });
    });

    it('register calls POST /auth/register with the registration payload', async () => {
      const spy = jest.spyOn(api, 'post').mockReturnValue(mockResolvedData({}) as any);
      const payload = { email: 'user@example.com', password: 'password123', fullName: 'A' };

      await authApi.register(payload);

      expect(spy).toHaveBeenCalledWith('/auth/register', payload);
    });
  });

  describe('userApi', () => {
    it('getProfile calls GET /users/me', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData({}) as any);

      await userApi.getProfile();

      expect(spy).toHaveBeenCalledWith('/users/me');
    });

    it('updateProfile calls PATCH /users/me with the given data', async () => {
      const spy = jest.spyOn(api, 'patch').mockReturnValue(mockResolvedData({}) as any);

      await userApi.updateProfile({ fullName: 'B' });

      expect(spy).toHaveBeenCalledWith('/users/me', { fullName: 'B' });
    });

    it('uploadAvatar sends the file as multipart/form-data', async () => {
      const spy = jest.spyOn(api, 'patch').mockReturnValue(mockResolvedData({}) as any);
      const file = new File(['content'], 'avatar.png', { type: 'image/png' });

      await userApi.uploadAvatar(file);

      expect(spy).toHaveBeenCalledWith(
        '/users/me/avatar',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    });
  });

  describe('orderApi', () => {
    it('getMyOrders calls GET /orders', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData([]) as any);

      await orderApi.getMyOrders();

      expect(spy).toHaveBeenCalledWith('/orders');
    });

    it('getOrder calls GET /orders/:id', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData({}) as any);

      await orderApi.getOrder('order-1');

      expect(spy).toHaveBeenCalledWith('/orders/order-1');
    });

    it('createOrder calls POST /orders with the order payload', async () => {
      const spy = jest.spyOn(api, 'post').mockReturnValue(mockResolvedData({}) as any);
      const payload = {
        shippingAddress: {
          fullName: 'A',
          phone: '0900000000',
          address: '123 X',
          ward: 'P1',
          district: 'Q1',
          city: 'HCM',
        },
        paymentMethod: 'cod',
        items: [{ cartItemId: 'c1', quantity: 1 }],
      };

      await orderApi.createOrder(payload);

      expect(spy).toHaveBeenCalledWith('/orders', payload);
    });

    it('buyNow calls POST /orders/buy-now with the buy-now payload', async () => {
      const spy = jest.spyOn(api, 'post').mockReturnValue(mockResolvedData({}) as any);
      const payload = {
        shippingAddress: {
          fullName: 'A',
          phone: '0900000000',
          address: '123 X',
          ward: 'P1',
          district: 'Q1',
          city: 'HCM',
        },
        paymentMethod: 'cod',
        items: [{ productId: 'p1', quantity: 1 }],
      };

      await orderApi.buyNow(payload);

      expect(spy).toHaveBeenCalledWith('/orders/buy-now', payload);
    });
  });

  describe('paymentMethodApi', () => {
    it('getMethods calls GET /payments/methods', async () => {
      const spy = jest.spyOn(api, 'get').mockReturnValue(mockResolvedData([]) as any);

      await paymentMethodApi.getMethods();

      expect(spy).toHaveBeenCalledWith('/payments/methods');
    });
  });
});
