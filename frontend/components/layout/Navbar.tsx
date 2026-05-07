'use client';

import Link from 'next/link';
import { ShoppingCart, User, Search, Menu, X, Zap } from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { useEffect, useState } from 'react';

export function Navbar() {
  const { itemCount, fetchCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchCart();
  }, []);

  const categories = [
    { label: 'Điện thoại', href: '/?category=smartphone' },
    { label: 'Laptop', href: '/?category=laptop' },
    { label: 'Tablet', href: '/?category=tablet' },
    { label: 'Phụ kiện', href: '/?category=accessory' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container-page">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 shrink-0">
            <Zap className="w-6 h-6 fill-blue-600" />
            TechShop
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 ml-4">
            {categories.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                {c.label}
              </Link>
            ))}
          </nav>

          {/* Search bar */}
          <div className="flex-1 hidden md:block mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm điện thoại, laptop..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50
                           text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="w-5 h-5" />
            </button>

            <Link
              href="/cart"
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white
                                 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <Link href="/profile" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <User className="w-5 h-5 text-gray-700" />
            </Link>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        {searchOpen && (
          <div className="md:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm sản phẩm..."
                autoFocus
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50
                           text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-gray-100 py-2">
            {categories.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2.5 text-sm font-medium text-gray-700 hover:text-blue-600
                           hover:bg-blue-50 rounded-lg transition-colors"
              >
                {c.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
