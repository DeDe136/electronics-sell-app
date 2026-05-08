'use client';

import { useEffect, useState } from 'react';
import { User, Package, MapPin, Phone, Mail, Camera, LogOut } from 'lucide-react';
import { userApi, orderApi, authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'orders';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  role: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderCode: string;
  total: number;
  status: string;
  createdAt: string;
  items: any[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Chờ xác nhận', color: 'bg-yellow-100 text-yellow-700' },
  confirmed:  { label: 'Đã xác nhận',  color: 'bg-blue-100 text-blue-700' },
  shipping:   { label: 'Đang giao',    color: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Đã giao',      color: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Đã hủy',       color: 'bg-red-100 text-red-700' },
  refunded:   { label: 'Hoàn tiền',    color: 'bg-gray-100 text-gray-600' },
};

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', address: '' });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5MB');
      return;
    }
    setUploadingAvatar(true);
    try {
      const updated = await userApi.uploadAvatar(file);
      setUser(updated);
      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch {
      toast.error('Upload ảnh thất bại');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { window.location.href = '/login'; return; }

    Promise.all([userApi.getProfile(), orderApi.getMyOrders()])
      .then(([profile, myOrders]) => {
        setUser(profile);
        setOrders(myOrders);
        setForm({ fullName: profile.fullName, phone: profile.phone || '', address: profile.address || '' });
      })
      .catch(() => toast.error('Không thể tải thông tin'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await userApi.updateProfile(form);
      setUser(updated);
      toast.success('Cập nhật thành công!');
    } catch {
      toast.error('Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="container-page py-12 animate-pulse">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-32 bg-gray-200 rounded-2xl" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container-page py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header card */}
        <div className="card p-6 mb-6 flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-white shadow">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-9 h-9 text-blue-400" />
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 bg-white border border-gray-200 rounded-full p-1 cursor-pointer shadow hover:bg-gray-50">
              {uploadingAvatar
                ? <span className="w-3.5 h-3.5 block border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : <Camera className="w-3.5 h-3.5 text-gray-500" />
              }
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{user.fullName}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full
              ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
              {user.role === 'admin' ? 'Admin' : 'Khách hàng'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0 text-red-500 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {([['profile', 'Thông tin cá nhân'], ['orders', 'Đơn hàng của tôi']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors
                          ${tab === t ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" /> Thông tin cá nhân
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Số điện thoại
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0901234567"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Địa chỉ
                </label>
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={handleSave} loading={saving}>Lưu thay đổi</Button>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="card p-12 text-center">
                <Package className="w-16 h-16 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">Bạn chưa có đơn hàng nào</p>
              </div>
            ) : (
              orders.map((order) => {
                const st = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={order.id} className="card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{order.orderCode}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="border-t pt-3 flex items-center justify-between">
                      <p className="text-sm text-gray-500">
                        {order.items?.length || 0} sản phẩm
                      </p>
                      <p className="font-bold text-red-600">{formatPrice(order.total)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}