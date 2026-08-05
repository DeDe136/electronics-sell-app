'use client';

import Link from 'next/link';
import { ShoppingCart, User, Search, Zap, Sun, Moon } from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

export function Navbar() {
  const { itemCount, fetchCart } = useCart();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [query, setQuery]         = useState('');
  const { theme, setTheme }       = useTheme();

  useEffect(() => {
    setMounted(true);
    fetchCart();
  }, [fetchCart]);

  // Navbar không lặp lại category pills / sort / lọc giá (đã có sẵn ở
  // page.tsx) — thay vào đó xử lý đúng chức năng riêng của nó: tìm kiếm.
  // Trước đây input này không có value/onChange nên gõ gì cũng vô tác dụng.
  // `search` param đã được backend hỗ trợ sẵn (ILIKE trên p.name/p.brand)
  // nên chỉ cần điều hướng về `/?search=<query>` là chạy được ngay.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?search=${encodeURIComponent(q)}` : '/');
    setSearchOpen(false);
  };

  const inputCls = `w-full pl-9 pr-4 py-2 rounded-lg text-sm
    border border-gray-200 dark:border-slate-600/70
    bg-gray-100 dark:bg-slate-800/80
    text-gray-900 dark:text-slate-100
    placeholder-gray-400 dark:placeholder-slate-500
    focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
    focus:border-transparent transition-colors`;

  const iconBtn = `p-2 rounded-lg transition-colors
    text-gray-600 dark:text-slate-300
    hover:bg-gray-100 dark:hover:bg-slate-700/70`;

  return (
    <header className="sticky top-0 z-50
      bg-white/90 dark:bg-[#0d1117]/90
      border-b border-gray-200 dark:border-slate-700/60
      shadow-sm dark:shadow-slate-900/50
      backdrop-blur-md">
      <div className="container-page">
        <div className="flex items-center h-16 gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl shrink-0
            text-blue-600 dark:text-blue-400">
            <Zap className="w-6 h-6 fill-blue-600 dark:fill-blue-400" />
            TechShop
          </Link>

          {/* Search bar desktop — chức năng riêng của Navbar, không trùng
              với sort/filter đã có ở page.tsx */}
          <form onSubmit={handleSearch} className="flex-1 hidden md:block mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm điện thoại, laptop..."
                className={inputCls}
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-0.5 ml-auto">
            <button className={`md:hidden ${iconBtn}`} onClick={() => setSearchOpen(!searchOpen)}>
              <Search className="w-5 h-5" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={iconBtn}
              aria-label="Đổi giao diện"
            >
              {mounted && theme === 'dark'
                ? <Sun className="w-5 h-5 text-amber-400" />
                : <Moon className="w-5 h-5" />}
            </button>

            {/* Cart */}
            <Link href="/cart" className={`relative ${iconBtn}`}>
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5
                  bg-red-500 dark:bg-red-400 text-white
                  text-xs font-bold w-5 h-5 rounded-full
                  flex items-center justify-center leading-none shadow-sm">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {/* Profile */}
            <Link href="/profile" className={iconBtn}>
              <User className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Mobile search */}
        {searchOpen && (
          <form onSubmit={handleSearch} className="md:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm sản phẩm..."
                autoFocus
                className={inputCls}
              />
            </div>
          </form>
        )}
      </div>
    </header>
  );
}