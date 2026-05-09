'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ShoppingBag, ArrowRight, Minus, Plus } from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { Button } from '@/components/ui/Button';

export default function CartPage() {
  const { items, subtotal, itemCount, isLoading, fetchCart, updateQuantity, removeItem } = useCart();

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  const SHIPPING_FEE = 30000;
  const total = subtotal + SHIPPING_FEE;

  if (isLoading) {
    return (
      <div className="container-page py-12">
        <div className="animate-pulse space-y-4 max-w-3xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 flex gap-4">
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

        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const price = item.product.salePrice || item.product.price;
            return (
              <div key={item.id} className="card p-4 flex gap-4">
                {/* Thumbnail */}
                <Link href={`/products/${item.product.slug}`} className="shrink-0">
                  <div className="w-24 h-24 rounded-lg overflow-hidden relative
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

                  <div className="flex items-center justify-between mt-3">
                    {/* Stepper */}
                    <div className="flex items-center rounded-lg overflow-hidden
                      border border-gray-200 dark:border-slate-600">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-2.5 py-1.5 transition-colors
                          text-gray-500 dark:text-slate-400
                          hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 text-sm font-semibold
                        border-x border-gray-200 dark:border-slate-600
                        text-gray-800 dark:text-slate-100">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-2.5 py-1.5 transition-colors
                          text-gray-500 dark:text-slate-400
                          hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">
                        {formatPrice(price * item.quantity)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {formatPrice(price)} / sp
                      </p>
                    </div>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 p-1 transition-colors
                    text-gray-300 dark:text-slate-600
                    hover:text-red-500 dark:hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-20">
            <h2 className="font-semibold mb-4 text-gray-800 dark:text-slate-100">
              Tóm tắt đơn hàng
            </h2>

            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between text-gray-600 dark:text-slate-300">
                <span>Tạm tính ({itemCount} sản phẩm)</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-slate-300">
                <span>Phí vận chuyển</span>
                <span>{formatPrice(SHIPPING_FEE)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-base
                border-gray-100 dark:border-slate-700/60
                text-gray-900 dark:text-slate-100">
                <span>Tổng cộng</span>
                <span className="text-red-600 dark:text-red-400">{formatPrice(total)}</span>
              </div>
            </div>

            <Link href="/checkout">
              <Button size="lg" className="w-full">
                Tiến hành đặt hàng
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

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