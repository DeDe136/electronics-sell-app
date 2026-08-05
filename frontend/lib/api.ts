import axios from 'axios';

// axios instance này được dùng ở CẢ 2 nơi:
//   1. Client Components trong useEffect/event handler -> chạy TRONG TRÌNH
//      DUYỆT của người dùng.
//   2. Server Components (vd: app/page.tsx gọi trực tiếp lúc render, không
//      qua useEffect) -> chạy TRÊN SERVER, tức BÊN TRONG container frontend.
//
// 2 ngữ cảnh này cần 2 địa chỉ backend khác nhau:
//   - Trình duyệt cần gọi tới cổng đã publish ra máy host (NEXT_PUBLIC_API_URL,
//     vd "http://localhost:3001"), vì trình duyệt không nằm trong docker network.
//   - Server (bên trong container frontend) cần gọi sang container backend
//     bằng TÊN SERVICE (INTERNAL_API_URL, vd "http://backend:3001"), vì
//     "localhost" từ trong container frontend sẽ trỏ về chính nó, không
//     phải container backend.
//
// "typeof window === 'undefined'" là cách chuẩn để phân biệt: Next.js build
// ra 2 bundle riêng (server bundle & browser bundle) — trên server, "window"
// không tồn tại (undefined); trong trình duyệt, "window" luôn có sẵn.
const API_URL =
  typeof window === 'undefined'
    ? // Đang chạy trên SERVER (SSR / Server Component)
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001/api/v1'
    : // Đang chạy trong TRÌNH DUYỆT
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Ping server-side health check → log hiện trong terminal Next.js ──
// if (typeof window !== 'undefined') {
//   fetch('/api/health-check').catch(() => {
//     // Lỗi fetch nội bộ (Next.js chưa ready) — bỏ qua, không cần xử lý
//   });
// }

// Gắn JWT token vào mọi request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto logout nếu 401
let isRedirectingToLogin = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !isRedirectingToLogin &&
      window.location.pathname !== '/login'
    ) {
      isRedirectingToLogin = true;
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ===== Catalog API =====
export const catalogApi = {
  getProducts: (params?: Record<string, any>) =>
    api.get('/catalog/products', { params }).then((r) => r.data),

  getProduct: (slug: string) =>
    api.get(`/catalog/products/${slug}`).then((r) => r.data),

  getCategories: () =>
    api.get('/catalog/categories').then((r) => r.data),
};

// ===== Cart API =====
export const cartApi = {
  getCart: () => api.get('/cart').then((r) => r.data),
  addItem: (data: { productId: string; quantity: number; variantId?: string }) =>
    api.post('/cart/items', data).then((r) => r.data),
  updateQuantity: (itemId: string, quantity: number) =>
    api.patch(`/cart/items/${itemId}`, { quantity }).then((r) => r.data),
  removeItem: (itemId: string) =>
    api.delete(`/cart/items/${itemId}`).then((r) => r.data),
  removeItems: (itemIds: string[]) =>
    api.delete('/cart/items', { data: { itemIds } }).then((r) => r.data),
  clearCart: () => api.delete('/cart').then((r) => r.data),
};

// ===== Auth API =====
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  register: (data: { email: string; password: string; fullName: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
};

// ===== User API =====
export const userApi = {
  getProfile: () => api.get('/users/me').then((r) => r.data),
  updateProfile: (data: any) => api.patch('/users/me', data).then((r) => r.data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.patch('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

// ===== Order API =====
export interface OrderItemInput {
  cartItemId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    ward: string;
    district: string;
    city: string;
  };
  paymentMethod: string;
  items: OrderItemInput[];
  note?: string;
}

export interface BuyNowItemPayload {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface BuyNowPayload {
  shippingAddress: CreateOrderPayload['shippingAddress'];
  paymentMethod: string;
  items: BuyNowItemPayload[];
  note?: string;
}

export const orderApi = {
  getMyOrders: () => api.get('/orders').then((r) => r.data),
  getOrder: (id: string) => api.get(`/orders/${id}`).then((r) => r.data),
  createOrder: (data: CreateOrderPayload) => api.post('/orders', data).then((r) => r.data),
  buyNow: (data: BuyNowPayload) => api.post('/orders/buy-now', data).then((r) => r.data),
};

// ===== Payment Method Options API =====
// GET /payments/methods — public, không cần JWT
export const paymentMethodApi = {
  getMethods: () => api.get('/payments/methods').then((r) => r.data),
};