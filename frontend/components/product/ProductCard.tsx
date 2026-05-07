'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Star } from 'lucide-react';
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

  // Hiển thị tối đa 2 spec nổi bật
  const specEntries = Object.entries(product.specs).slice(0, 2);

  return (
    <div className="card group hover:shadow-md transition-shadow duration-200">
      {/* Image */}
      <Link href={`/products/${product.slug}`} className="block relative aspect-square bg-gray-50">
        {product.images?.[0] ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            No image
          </div>
        )}
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold
                           px-2 py-0.5 rounded-md">
            -{discountPct}%
          </span>
        )}
      </Link>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">
          {product.brand}
        </p>
        <Link href={`/products/${product.slug}`}>
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 hover:text-blue-600
                         transition-colors leading-snug mb-2">
            {product.name}
          </h3>
        </Link>

        {/* Key specs */}
        {specEntries.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {specEntries.map(([key, val]) => (
              <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {val}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mb-3">
          <span className="text-base font-bold text-red-600">{formatPrice(price)}</span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through ml-2">
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* Sold count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Đã bán {product.soldCount.toLocaleString()}</span>
          <button
            onClick={() => addItem(product.id)}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white
                       text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-3 h-3" />
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}
