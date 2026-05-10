'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Phone, User, FileText, ChevronRight,
  ShoppingBag, CheckCircle, Loader2, ArrowLeft,
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { orderApi, paymentMethodApi, type CreateOrderPayload } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  ward: string;
  district: string;
  city: string;
}

/** Cấu trúc trả về từ GET /payments/methods */
interface PaymentMethodOption {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  /** metadata tuỳ biến mỗi phương thức — ví dụ bankName, accountNumber... */
  metadata: Record<string, any> | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIPPING_FEE = 30_000;

const INITIAL_FORM: ShippingAddress = {
  fullName: '',
  phone: '',
  address: '',
  ward: '',
  district: '',
  city: 'Hồ Chí Minh',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, itemCount, isLoading, fetchCart, clearCart } = useCart();

  const [form, setForm] = useState<ShippingAddress>(INITIAL_FORM);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<ShippingAddress>>({});

  // Payment method options từ database
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  // ── Fetch dữ liệu khi mount ──────────────────────────────────────────────
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      toast.error('Vui lòng đăng nhập để đặt hàng');
      router.push('/login');
      return;
    }
    fetchCart();
  }, [fetchCart, router]);

  useEffect(() => {
    setMethodsLoading(true);
    paymentMethodApi
      .getMethods()
      .then((data: PaymentMethodOption[]) => {
        setPaymentMethods(data);
        if (data.length > 0) setSelectedMethod(data[0].code);
      })
      .catch(() => toast.error('Không tải được phương thức thanh toán'))
      .finally(() => setMethodsLoading(false));
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  const total = subtotal + SHIPPING_FEE;

  // ── Validate ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Partial<ShippingAddress> = {};
    if (!form.fullName.trim()) e.fullName = 'Vui lòng nhập họ tên';
    if (!form.phone.trim()) e.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^(0|\+84)[0-9]{8,10}$/.test(form.phone.trim()))
      e.phone = 'Số điện thoại không hợp lệ';
    if (!form.address.trim()) e.address = 'Vui lòng nhập địa chỉ';
    if (!form.ward.trim()) e.ward = 'Vui lòng nhập phường/xã';
    if (!form.district.trim()) e.district = 'Vui lòng nhập quận/huyện';
    if (!form.city.trim()) e.city = 'Vui lòng nhập tỉnh/thành phố';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (field: keyof ShippingAddress, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Vui lòng điền đầy đủ thông tin giao hàng');
      return;
    }
    if (!items.length) {
      toast.error('Giỏ hàng trống');
      return;
    }
    if (!selectedMethod) {
      toast.error('Vui lòng chọn phương thức thanh toán');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateOrderPayload = {
        shippingAddress: form,
        paymentMethod: selectedMethod,
        note: note.trim() || undefined,
      };
      const order = await orderApi.createOrder(payload);

      await clearCart();
      router.push(`/order-success?orderId=${order.id}&orderCode=${order.orderCode}`);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (Array.isArray(msg)) toast.error(msg[0]);
      else toast.error(msg || 'Đặt hàng thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="container-page py-12">
        <div className="animate-pulse max-w-5xl mx-auto grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-gray-200 dark:bg-slate-700 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Empty cart guard ──────────────────────────────────────────────────────

  if (!isLoading && !items.length) {
    return (
      <div className="container-page py-20 text-center">
        <ShoppingBag className="w-20 h-20 mx-auto mb-4 text-gray-200 dark:text-slate-700" />
        <h2 className="text-xl font-semibold mb-2 text-gray-500 dark:text-slate-400">
          Giỏ hàng trống
        </h2>
        <p className="text-sm mb-6 text-gray-400 dark:text-slate-500">
          Thêm sản phẩm vào giỏ trước khi đặt hàng nhé!
        </p>
        <Link href="/">
          <Button>Khám phá sản phẩm</Button>
        </Link>
      </div>
    );
  }

  // ── Helper: metadata card cho phương thức đang chọn ──────────────────────

  const activeMethod = paymentMethods.find((m) => m.code === selectedMethod);

  const renderMetadataCard = (method: PaymentMethodOption) => {
    const { metadata } = method;
    if (!metadata) return null;

    // Bank transfer: hiện thông tin tài khoản
    if (method.code === 'bank_transfer') {
      return (
        <div className="mt-4 p-4 rounded-xl text-sm space-y-1.5
          bg-blue-50 dark:bg-blue-950/30
          border border-blue-100 dark:border-blue-900/50">
          <p className="font-semibold text-blue-700 dark:text-blue-300">Thông tin chuyển khoản:</p>
          {metadata.bankName && (
            <p className="text-gray-700 dark:text-slate-300">
              Ngân hàng: <strong>{metadata.bankName}</strong>
              {metadata.branch && <span className="text-gray-400 dark:text-slate-500 text-xs ml-1">({metadata.branch})</span>}
            </p>
          )}
          {metadata.accountNumber && (
            <p className="text-gray-700 dark:text-slate-300">
              Số tài khoản: <strong>{metadata.accountNumber}</strong>
            </p>
          )}
          {metadata.accountName && (
            <p className="text-gray-700 dark:text-slate-300">
              Chủ tài khoản: <strong>{metadata.accountName}</strong>
            </p>
          )}
          {metadata.note && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              * {metadata.note}
            </p>
          )}
        </div>
      );
    }

    // MoMo: hiện số điện thoại
    if (method.code === 'momo') {
      return (
        <div className="mt-4 p-4 rounded-xl text-sm space-y-1.5
          bg-purple-50 dark:bg-purple-950/30
          border border-purple-100 dark:border-purple-900/50">
          <p className="font-semibold text-purple-700 dark:text-purple-300">Thông tin ví MoMo:</p>
          {metadata.phoneNumber && (
            <p className="text-gray-700 dark:text-slate-300">
              Số điện thoại: <strong>{metadata.phoneNumber}</strong>
            </p>
          )}
          {metadata.accountName && (
            <p className="text-gray-700 dark:text-slate-300">
              Tên tài khoản: <strong>{metadata.accountName}</strong>
            </p>
          )}
          {metadata.note && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
              * {metadata.note}
            </p>
          )}
        </div>
      );
    }

    // VNPay: hiện danh sách thẻ hỗ trợ
    if (method.code === 'vnpay' && metadata.supportedCards) {
      return (
        <div className="mt-4 p-4 rounded-xl text-sm
          bg-emerald-50 dark:bg-emerald-950/30
          border border-emerald-100 dark:border-emerald-900/50">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300 mb-2">Hỗ trợ:</p>
          <div className="flex flex-wrap gap-2">
            {(metadata.supportedCards as string[]).map((card: string) => (
              <span
                key={card}
                className="px-2.5 py-1 rounded-full text-xs font-medium
                  bg-white dark:bg-slate-800
                  border border-emerald-200 dark:border-emerald-800
                  text-emerald-700 dark:text-emerald-300"
              >
                {card}
              </span>
            ))}
          </div>
          {metadata.note && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              * {metadata.note}
            </p>
          )}
        </div>
      );
    }

    // COD hoặc fallback: hiện note nếu có
    if (metadata.note) {
      return (
        <p className="mt-3 text-xs text-gray-500 dark:text-slate-400 pl-1">
          ℹ️ {metadata.note}
        </p>
      );
    }

    return null;
  };

  // ── Input field helper ────────────────────────────────────────────────────

  const inputCls = (field: keyof ShippingAddress) =>
    `w-full px-3 py-2.5 text-sm rounded-lg border transition-colors
    bg-white dark:bg-slate-900/60
    text-gray-900 dark:text-slate-100
    placeholder-gray-400 dark:placeholder-slate-500
    focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${
      errors[field]
        ? 'border-red-400 dark:border-red-500'
        : 'border-gray-300 dark:border-slate-600'
    }`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6 flex items-center gap-2 text-gray-500 dark:text-slate-400">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Trang chủ</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/cart" className="hover:text-blue-600 dark:hover:text-blue-400">Giỏ hàng</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-800 dark:text-slate-100 font-medium">Đặt hàng</span>
      </nav>

      <h1 className="text-2xl font-bold mb-8 text-gray-900 dark:text-slate-100">
        Thông tin đặt hàng
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">

        {/* ── Left: Form ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Địa chỉ giao hàng */}
          <div className="card p-6">
            <h2 className="font-semibold text-base mb-5 flex items-center gap-2
              text-gray-900 dark:text-slate-100">
              <MapPin className="w-5 h-5 text-blue-500" />
              Địa chỉ giao hàng
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Họ tên */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-slate-300">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    className={`${inputCls('fullName')} pl-9`}
                  />
                </div>
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Số điện thoại */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-slate-300">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="0901 234 567"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={`${inputCls('phone')} pl-9`}
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* Địa chỉ */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-slate-300">
                  Số nhà, tên đường <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="123 Nguyễn Trãi"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className={inputCls('address')}
                />
                {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
              </div>

              {/* Phường/Xã */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-slate-300">
                  Phường/Xã <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Phường 2"
                  value={form.ward}
                  onChange={(e) => handleChange('ward', e.target.value)}
                  className={inputCls('ward')}
                />
                {errors.ward && <p className="text-xs text-red-500 mt-1">{errors.ward}</p>}
              </div>

              {/* Quận/Huyện */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-slate-300">
                  Quận/Huyện <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Quận 5"
                  value={form.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className={inputCls('district')}
                />
                {errors.district && <p className="text-xs text-red-500 mt-1">{errors.district}</p>}
              </div>

              {/* Tỉnh/Thành phố */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-slate-300">
                  Tỉnh/Thành phố <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Hồ Chí Minh"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className={inputCls('city')}
                />
                {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
              </div>
            </div>
          </div>

          {/* Phương thức thanh toán — dữ liệu từ DB */}
          <div className="card p-6">
            <h2 className="font-semibold text-base mb-4 text-gray-900 dark:text-slate-100">
              Phương thức thanh toán
            </h2>

            {methodsLoading ? (
              /* Skeleton */
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-gray-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : paymentMethods.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">
                Không có phương thức thanh toán nào khả dụng
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.code}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                        ${selectedMethod === method.code
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'}`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.code}
                        checked={selectedMethod === method.code}
                        onChange={() => setSelectedMethod(method.code)}
                        className="accent-blue-600"
                      />
                      <span className="text-2xl shrink-0">{method.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                          {method.name}
                        </p>
                        {method.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                            {method.description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* Chi tiết bổ sung của phương thức đang chọn */}
                {activeMethod && renderMetadataCard(activeMethod)}
              </>
            )}
          </div>

          {/* Ghi chú */}
          <div className="card p-6">
            <h2 className="font-semibold text-base mb-4 flex items-center gap-2
              text-gray-900 dark:text-slate-100">
              <FileText className="w-5 h-5 text-blue-500" />
              Ghi chú đơn hàng
            </h2>
            <textarea
              rows={3}
              placeholder="Giao giờ hành chính, gọi trước 30 phút..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors resize-none
                bg-white dark:bg-slate-900/60
                text-gray-900 dark:text-slate-100
                placeholder-gray-400 dark:placeholder-slate-500
                border-gray-300 dark:border-slate-600
                focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>
        </div>

        {/* ── Right: Tóm tắt đơn hàng ──────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-20">
            <h2 className="font-semibold mb-4 text-gray-800 dark:text-slate-100">
              Đơn hàng ({itemCount} sản phẩm)
            </h2>

            {/* Danh sách sản phẩm */}
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => {
                const price = item.product.salePrice || item.product.price;
                return (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="w-12 h-12 rounded-lg overflow-hidden relative shrink-0
                      bg-gray-50 dark:bg-slate-800
                      border border-gray-100 dark:border-slate-700">
                      {item.product.images?.[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          fill
                          className="object-contain p-1"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 dark:bg-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-2 text-gray-800 dark:text-slate-200">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                        x{item.quantity}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                      {formatPrice(price * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Tổng tiền */}
            <div className="space-y-2 text-sm border-t pt-4 border-gray-100 dark:border-slate-700/60">
              <div className="flex justify-between text-gray-600 dark:text-slate-300">
                <span>Tạm tính</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-slate-300">
                <span>Phí vận chuyển</span>
                <span>{formatPrice(SHIPPING_FEE)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2
                border-t border-gray-100 dark:border-slate-700/60
                text-gray-900 dark:text-slate-100">
                <span>Tổng cộng</span>
                <span className="text-red-600 dark:text-red-400">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Xác nhận */}
            <Button
              size="lg"
              className="w-full mt-5"
              loading={submitting}
              onClick={handleSubmit}
              disabled={submitting || methodsLoading}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang đặt hàng...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Xác nhận đặt hàng
                </>
              )}
            </Button>

            <Link
              href="/cart"
              className="flex items-center justify-center gap-1 text-sm mt-3 transition-colors
                text-blue-600 dark:text-blue-400
                hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại giỏ hàng
            </Link>

            {/* Trust badges */}
            <div className="border-t mt-4 pt-4 space-y-1 border-gray-100 dark:border-slate-700/60">
              {['🔒 Thanh toán an toàn', '🚚 Giao hàng toàn quốc', '✅ Hàng chính hãng 100%'].map((t) => (
                <p key={t} className="text-xs text-center text-gray-400 dark:text-slate-500">{t}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}