import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Ping server-side health check → log hiện trong terminal Next.js ──
if (typeof window !== 'undefined') {
  fetch('/api/health-check').catch(() => {
    // Lỗi fetch nội bộ (Next.js chưa ready) — bỏ qua, không cần xử lý
  });
}

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
export const orderApi = {
  getMyOrders: () => api.get('/orders').then((r) => r.data),
  getOrder: (id: string) => api.get(`/orders/${id}`).then((r) => r.data),
  createOrder: (data: any) => api.post('/orders', data).then((r) => r.data),
};

// ===== Payment Method Options API =====
// GET /payments/methods — public, không cần JWT
export const paymentMethodApi = {
  getMethods: () => api.get('/payments/methods').then((r) => r.data),
};