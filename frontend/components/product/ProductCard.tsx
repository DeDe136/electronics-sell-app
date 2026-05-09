'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  salePrice?: number;
  images: { url: string }[];
  specs: Record<string, string>;
  soldCount: number;
  category: { name: string };
}

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const price = product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  const specEntries = Object.entries(product.specs).slice(0, 2);

  return (
    <div className="card group hover:shadow-lg dark:hover:shadow-slate-900/60
      hover:-translate-y-0.5 transition-all duration-200">
      {/* Image */}
      <Link
        href={`/products/${product.slug}`}
        className="block relative aspect-square
          bg-gray-50 dark:bg-slate-800/50"
      >
        {product.images?.[0] ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center
            text-gray-300 dark:text-slate-600 text-sm">
            No image
          </div>
        )}
        {hasDiscount && (
          <span className="absolute top-2 left-2
            bg-red-500 dark:bg-red-500 text-white
            text-xs font-bold px-2 py-0.5 rounded-md shadow-sm">
            -{discountPct}%
          </span>
        )}
      </Link>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-semibold uppercase tracking-wide mb-1
          text-blue-600 dark:text-blue-400">
          {product.brand}
        </p>

        <Link href={`/products/${product.slug}`}>
          <h3 className="text-sm font-semibold line-clamp-2 leading-snug mb-2
            text-gray-800 dark:text-slate-100
            hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Key specs */}
        {specEntries.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {specEntries.map(([key, val]) => (
              <span key={key} className="chip">{val}</span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mb-3">
          <span className="text-base font-bold text-red-600 dark:text-red-400">
            {formatPrice(price)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 dark:text-slate-500 line-through ml-2">
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Đã bán {product.soldCount.toLocaleString()}
          </span>
          <button
            onClick={() => addItem(product.id, 1)}
            className="flex items-center gap-1
              bg-blue-600 hover:bg-blue-500 active:bg-blue-700
              dark:bg-blue-500 dark:hover:bg-blue-400
              text-white text-xs font-medium
              px-3 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            <ShoppingCart className="w-3 h-3" />
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}