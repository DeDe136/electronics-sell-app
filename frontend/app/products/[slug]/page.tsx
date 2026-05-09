'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ShoppingCart, Shield, Truck, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { catalogApi } from '@/lib/api';
import { ProductSpecs } from '@/components/product/ProductSpecs';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/hooks/useCart';

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  const [product, setProduct]               = useState<any>(null);
  const [loading, setLoading]               = useState(true);
  const [activeImg, setActiveImg]           = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity]             = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    catalogApi.getProduct(params.slug)
      .then((data) => {
        setProduct(data);
        if (data.variants?.length) setSelectedVariant(data.variants[0]);
      })
      .catch(() => notFound())
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) {
    return (
      <div className="container-page py-12 animate-pulse">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 dark:bg-slate-700 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3" />
            <div className="h-24 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const price = selectedVariant?.price || product.salePrice || product.price;
  const hasDiscount = !selectedVariant && product.salePrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.salePrice) / product.price) * 100) : 0;

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  const images = product.images?.length
    ? product.images
    : [{ url: 'https://placehold.co/600x600?text=No+Image' }];

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6 flex gap-2 text-gray-500 dark:text-slate-400">
        <a href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Trang chủ</a>
        <span>/</span>
        <span className="text-gray-800 dark:text-slate-100 font-medium">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">

        {/* Images */}
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden mb-3
            bg-gray-50 dark:bg-slate-800/60
            border border-gray-100 dark:border-slate-700/60">
            <Image
              src={images[activeImg]?.url}
              alt={product.name}
              fill
              className="object-contain p-6"
              priority
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2
                    bg-white dark:bg-slate-700 shadow rounded-full p-1.5
                    hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-slate-200" />
                </button>
                <button
                  onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2
                    bg-white dark:bg-slate-700 shadow rounded-full p-1.5
                    hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700 dark:text-slate-200" />
                </button>
              </>
            )}
            {hasDiscount && (
              <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
                -{discountPct}%
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden
                    bg-gray-50 dark:bg-slate-800 transition-colors
                    ${i === activeImg
                      ? 'border-blue-500'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-slate-500'}`}
                >
                  <Image src={img.url} alt="" width={64} height={64} className="object-contain w-full h-full p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide mb-1
            text-blue-600 dark:text-blue-400">
            {product.brand}
          </p>
          <h1 className="text-2xl font-bold mb-3 text-gray-900 dark:text-slate-100">
            {product.name}
          </h1>

          {/* Rating */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex text-yellow-400 text-sm">★★★★★</div>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              Đã bán {product.soldCount?.toLocaleString()}
            </span>
          </div>

          {/* Price box */}
          <div className="rounded-xl p-4 mb-4 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/50">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                {formatPrice(price)}
              </span>
              {hasDiscount && (
                <span className="text-lg text-gray-400 dark:text-slate-500 line-through">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>
          </div>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">Phiên bản:</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`px-3 py-2 text-sm border rounded-lg transition-colors
                                ${selectedVariant?.id === v.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                                  : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500'}`}
                  >
                    {v.label}
                    <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">
                      ({formatPrice(v.price)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Số lượng:</span>
            <div className="flex items-center rounded-lg overflow-hidden
              border border-gray-300 dark:border-slate-600">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 transition-colors text-gray-600 dark:text-slate-300
                  hover:bg-gray-100 dark:hover:bg-slate-700"
              >−</button>
              <span className="px-4 py-2 text-sm font-semibold
                border-x border-gray-300 dark:border-slate-600
                text-gray-800 dark:text-slate-100">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-2 transition-colors text-gray-600 dark:text-slate-300
                  hover:bg-gray-100 dark:hover:bg-slate-700"
              >+</button>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3 mb-6">
            <Button
              size="lg"
              onClick={() => addItem(product.id, quantity, selectedVariant?.id)}
              className="flex-1"
            >
              <ShoppingCart className="w-5 h-5" />
              Thêm vào giỏ
            </Button>
            <Button size="lg" variant="outline" className="flex-1">
              Mua ngay
            </Button>
          </div>

          {/* Policies */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs border-t pt-4
            border-gray-100 dark:border-slate-700/60
            text-gray-500 dark:text-slate-400">
            <div className="flex flex-col items-center gap-1">
              <Shield className="w-5 h-5 text-blue-500" />
              <span>Bảo hành chính hãng</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Truck className="w-5 h-5 text-green-500" />
              <span>Giao hàng toàn quốc</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              <span>Đổi trả 30 ngày</span>
            </div>
          </div>
        </div>
      </div>

      {/* Specs & Description */}
      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <ProductSpecs specs={product.specs} />

        {product.description && (
          <div className="rounded-xl p-4
            bg-gray-50 dark:bg-slate-800/60
            border border-gray-100 dark:border-slate-700/50">
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide
              text-gray-800 dark:text-slate-100">
              Mô tả sản phẩm
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line
              text-gray-600 dark:text-slate-300">
              {product.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}