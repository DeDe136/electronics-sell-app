'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Suspense } from 'react';

function OrderSuccessContent() {
  const params = useSearchParams();
  const orderCode = params.get('orderCode');

  return (
    <div className="container-page py-20 flex flex-col items-center text-center">
      {/* Animated check icon */}
      <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30
        flex items-center justify-center mb-6 animate-bounce-once">
        <CheckCircle className="w-14 h-14 text-green-500 dark:text-green-400" />
      </div>

      <h1 className="text-3xl font-bold mb-3 text-gray-900 dark:text-slate-100">
        Đặt hàng thành công! 🎉
      </h1>

      {orderCode && (
        <div className="mb-4 px-5 py-3 rounded-xl
          bg-gray-100 dark:bg-slate-800
          border border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-slate-400">Mã đơn hàng của bạn</p>
          <p className="text-xl font-bold tracking-wider text-blue-600 dark:text-blue-400 mt-0.5">
            {orderCode}
          </p>
        </div>
      )}

      <p className="text-gray-500 dark:text-slate-400 mb-2 max-w-md">
        Cảm ơn bạn đã tin tưởng TechShop! Chúng tôi đã nhận được đơn hàng của bạn và
        đang xử lý.
      </p>
      <p className="text-sm text-gray-400 dark:text-slate-500 mb-10">
        Bạn sẽ nhận được xác nhận qua email trong vài phút tới.
      </p>

      {/* Steps */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10 w-full max-w-lg">
        {[
          { icon: '✅', label: 'Đơn hàng đã đặt', done: true },
          { icon: '📦', label: 'Đang đóng gói', done: false },
          { icon: '🚚', label: 'Đang giao hàng', done: false },
        ].map((step, i) => (
          <div key={i} className={`flex flex-col items-center gap-2 p-4 rounded-xl
            ${step.done
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40'
              : 'bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/50'}`}>
            <span className="text-2xl">{step.icon}</span>
            <p className={`text-xs font-medium ${step.done
              ? 'text-green-700 dark:text-green-400'
              : 'text-gray-500 dark:text-slate-400'}`}>
              {step.label}
            </p>
          </div>
        ))}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/profile">
          <Button size="lg" variant="outline">
            <Package className="w-5 h-5" />
            Xem đơn hàng của tôi
          </Button>
        </Link>
        <Link href="/">
          <Button size="lg">
            <Home className="w-5 h-5" />
            Tiếp tục mua sắm
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container-page py-20 text-center">
        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-800 mx-auto mb-6 animate-pulse" />
        <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-64 mx-auto" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}