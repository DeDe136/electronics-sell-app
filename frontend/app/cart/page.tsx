'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2, ShoppingBag, ArrowRight, Minus, Plus, CheckSquare, Square,
} from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

// Số lượng muốn đặt cho từng item (có thể nhỏ hơn qty trong cart)
type OrderQtyMap = Record<string, number>; // cartItemId → orderQty

export default function CartPage() {
  const router = useRouter();
  const { items, subtotal, itemCount, isLoading, fetchCart, updateQuantity, removeItem } = useCart();

  // IDs của những item đã được tích chọn
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Số lượng muốn đặt cho từng item
  const [orderQtys, setOrderQtys] = useState<OrderQtyMap>({});

  useEffect(() => { fetchCart(); }, [fetchCart]);

  // Khi cart load xong: mặc định chọn hết + orderQty = cart qty
  useEffect(() => {
    if (!items.length) return;
    setSelectedIds(new Set(items.map((i) => i.id)));
    setOrderQtys(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  }, [items]);

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  const SHIPPING_FEE = 30_000;

  // ── Toggle chọn / bỏ chọn một item ──────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Khi chọn lại, reset orderQty về cart qty nếu chưa có
        const item = items.find((i) => i.id === id);
        if (item) {
          setOrderQtys((q) => ({ ...q, [id]: q[id] ?? item.quantity }));
        }
      }
      return next;
    });
  };

  // ── Chọn / bỏ chọn tất cả ────────────────────────────────────────────────
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
      setOrderQtys(Object.fromEntries(items.map((i) => [i.id, orderQtys[i.id] ?? i.quantity])));
    }
  };

  // ── Thay đổi order qty (0 → max = cart qty) ──────────────────────────────
  const changeOrderQty = (id: string, delta: number) => {
    const cartItem = items.find((i) => i.id === id);
    if (!cartItem) return;
    const current = orderQtys[id] ?? cartItem.quantity;
    const next = Math.max(1, Math.min(cartItem.quantity, current + delta));
    setOrderQtys((q) => ({ ...q, [id]: next }));
  };

  // ── Tóm tắt các item được chọn ──────────────────────────────────────────
  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const selectedSubtotal = selectedItems.reduce((sum, item) => {
    const price = item.product.salePrice || item.product.price;
    return sum + price * (orderQtys[item.id] ?? item.quantity);
  }, 0);
  const selectedTotal = selectedSubtotal + SHIPPING_FEE;

  // ── Tiến hành đặt hàng ───────────────────────────────────────────────────
  const handleCheckout = useCallback(() => {
    if (!selectedItems.length) {
      toast.error('Vui lòng chọn ít nhất một sản phẩm');
      return;
    }

    // Đóng gói danh sách items đã chọn kèm orderQty vào sessionStorage
    const payload = selectedItems.map((item) => ({
      cartItemId: item.id,
      quantity: orderQtys[item.id] ?? item.quantity,
      // Thêm thông tin hiển thị để checkout page render được mà không cần fetch lại
      productName: item.product.name,
      productImage: item.product.images?.[0]?.url ?? null,
      unitPrice: item.product.salePrice || item.product.price,
      variantId: item.variantId ?? null,
    }));

    sessionStorage.setItem('checkout_items', JSON.stringify(payload));
    router.push('/checkout');
  }, [selectedItems, orderQtys, router]);

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="container-page py-12">
        <div className="animate-pulse space-y-4 max-w-3xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 flex gap-4">
              <div className="w-6 h-6 bg-gray-200 dark:bg-slate-700 rounded mt-1 shrink-0" />
              <div className="w-24 h-24 bg-gray-200 dark:bg-slate-700 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="container-page py-20 text-center">
        <ShoppingBag className="w-20 h-20 mx-auto mb-4 text-gray-200 dark:text-slate-700" />
        <h2 className="text-xl font-semibold mb-2 text-gray-500 dark:text-slate-400">
          Giỏ hàng trống
        </h2>
        <p className="text-sm mb-6 text-gray-400 dark:text-slate-500">
          Hãy thêm sản phẩm yêu thích của bạn!
        </p>
        <Link href="/">
          <Button>Khám phá sản phẩm</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-slate-100">
        Giỏ hàng ({itemCount} sản phẩm)
      </h1>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Cart items ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Chọn tất cả */}
          <div className="card px-4 py-3 flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-medium transition-colors
                text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {allSelected
                ? <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                : <Square className="w-5 h-5 text-gray-400 dark:text-slate-500" />
              }
              Chọn tất cả ({items.length})
            </button>
            {selectedIds.size > 0 && (
              <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
                Đã chọn {selectedIds.size} sản phẩm
              </span>
            )}
          </div>

          {items.map((item) => {
            const price = item.product.salePrice || item.product.price;
            const isSelected = selectedIds.has(item.id);
            const oQty = orderQtys[item.id] ?? item.quantity;

            return (
              <div
                key={item.id}
                className={`card p-4 flex gap-3 transition-all ${
                  isSelected
                    ? 'ring-2 ring-blue-500/40 dark:ring-blue-500/30'
                    : 'opacity-60'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(item.id)}
                  className="shrink-0 mt-1 transition-colors
                    text-gray-400 dark:text-slate-500
                    hover:text-blue-600 dark:hover:text-blue-400"
                  aria-label={isSelected ? 'Bỏ chọn' : 'Chọn sản phẩm này'}
                >
                  {isSelected
                    ? <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    : <Square className="w-5 h-5" />
                  }
                </button>

                {/* Thumbnail */}
                <Link href={`/products/${item.product.slug}`} className="shrink-0">
                  <div className="w-20 h-20 rounded-lg overflow-hidden relative
                    bg-gray-50 dark:bg-slate-800/60
                    border border-gray-100 dark:border-slate-700/50">
                    {item.product.images?.[0] ? (
                      <Image
                        src={item.product.images[0].url}
                        alt={item.product.name}
                        fill className="object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-slate-700" />
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${item.product.slug}`}>
                    <h3 className="text-sm font-semibold line-clamp-2 transition-colors
                      text-gray-800 dark:text-slate-100
                      hover:text-blue-600 dark:hover:text-blue-400">
                      {item.product.name}
                    </h3>
                  </Link>
                  {item.variantId && (
                    <p className="text-xs mt-0.5 text-gray-400 dark:text-slate-500">
                      Phiên bản: {item.variantId}
                    </p>
                  )}

                  <div className="flex items-end justify-between mt-3 gap-2 flex-wrap">
                    <div className="space-y-1.5">
                      {/* Số lượng trong giỏ — điều chỉnh bằng API */}
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        Trong giỏ:&nbsp;
                        <span className="font-medium text-gray-600 dark:text-slate-300">
                          {item.quantity}
                        </span>
                      </p>

                      {/* Số lượng muốn đặt lần này — chỉ hiển thị khi đã chọn */}
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">
                            Đặt lần này:
                          </span>
                          <div className="flex items-center rounded-lg overflow-hidden
                            border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30">
                            <button
                              onClick={() => changeOrderQty(item.id, -1)}
                              disabled={oQty <= 1}
                              className="px-2 py-1 transition-colors
                                text-blue-500 dark:text-blue-400
                                hover:bg-blue-100 dark:hover:bg-blue-900/40
                                disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2.5 text-sm font-bold min-w-[2rem] text-center
                              border-x border-blue-300 dark:border-blue-700
                              text-blue-700 dark:text-blue-300">
                              {oQty}
                            </span>
                            <button
                              onClick={() => changeOrderQty(item.id, +1)}
                              disabled={oQty >= item.quantity}
                              className="px-2 py-1 transition-colors
                                text-blue-500 dark:text-blue-400
                                hover:bg-blue-100 dark:hover:bg-blue-900/40
                                disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {oQty < item.quantity && (
                            <span className="text-xs text-amber-500 dark:text-amber-400">
                              (còn lại {item.quantity - oQty} trong giỏ)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Stepper điều chỉnh tổng cart qty */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                          Sửa giỏ:
                        </span>
                        <div className="flex items-center rounded-lg overflow-hidden
                          border border-gray-200 dark:border-slate-600">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="px-2 py-1 transition-colors
                              text-gray-400 dark:text-slate-500
                              hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 text-xs font-semibold min-w-[2rem] text-center
                            border-x border-gray-200 dark:border-slate-600
                            text-gray-700 dark:text-slate-300">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="px-2 py-1 transition-colors
                              text-gray-400 dark:text-slate-500
                              hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Giá */}
                    <div className="text-right shrink-0">
                      {isSelected && oQty !== item.quantity ? (
                        <>
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {formatPrice(price * oQty)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 line-through">
                            {formatPrice(price * item.quantity)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {formatPrice(price * item.quantity)}
                          </p>
                        </>
                      )}
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {formatPrice(price)} / sp
                      </p>
                    </div>
                  </div>
                </div>

                {/* Xóa khỏi giỏ */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 p-1 self-start transition-colors
                    text-gray-300 dark:text-slate-600
                    hover:text-red-500 dark:hover:text-red-400"
                  title="Xóa khỏi giỏ hàng"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Summary ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-20">
            <h2 className="font-semibold mb-4 text-gray-800 dark:text-slate-100">
              Tóm tắt đơn hàng
            </h2>

            {selectedItems.length > 0 ? (
              <>
                {/* Danh sách items đã chọn */}
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
                  {selectedItems.map((item) => {
                    const price = item.product.salePrice || item.product.price;
                    const oQty = orderQtys[item.id] ?? item.quantity;
                    return (
                      <div key={item.id} className="flex justify-between text-xs
                        text-gray-600 dark:text-slate-400 gap-2">
                        <span className="line-clamp-1 flex-1">{item.product.name}</span>
                        <span className="shrink-0 font-medium text-gray-800 dark:text-slate-200">
                          x{oQty} · {formatPrice(price * oQty)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 text-sm border-t pt-3 mb-4
                  border-gray-100 dark:border-slate-700/60">
                  <div className="flex justify-between text-gray-600 dark:text-slate-300">
                    <span>Tạm tính ({selectedIds.size} sản phẩm)</span>
                    <span>{formatPrice(selectedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-slate-300">
                    <span>Phí vận chuyển</span>
                    <span>{formatPrice(SHIPPING_FEE)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-base
                    border-gray-100 dark:border-slate-700/60
                    text-gray-900 dark:text-slate-100">
                    <span>Tổng cộng</span>
                    <span className="text-red-600 dark:text-red-400">
                      {formatPrice(selectedTotal)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4 mb-4">
                Chưa chọn sản phẩm nào
              </p>
            )}

            <Button
              size="lg"
              className="w-full"
              disabled={selectedItems.length === 0}
              onClick={handleCheckout}
            >
              Đặt hàng {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              <ArrowRight className="w-4 h-4" />
            </Button>

            <Link
              href="/"
              className="block text-center text-sm mt-3 transition-colors
                text-blue-600 dark:text-blue-400
                hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
            >
              ← Tiếp tục mua sắm
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