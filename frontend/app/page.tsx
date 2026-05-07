import { Suspense } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { catalogApi } from '@/lib/api';
import { Filter, SlidersHorizontal } from 'lucide-react';

interface SearchParams {
  category?: string;
  search?: string;
  brand?: string;
  sort?: string;
  page?: string;
  minPrice?: string;
  maxPrice?: string;
}

async function getProducts(params: SearchParams) {
  try {
    return await catalogApi.getProducts({
      categoryId: params.category,
      search: params.search,
      brand: params.brand,
      sort: params.sort || 'newest',
      page: params.page || '1',
      limit: '20',
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
    });
  } catch {
    return { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  }
}

async function getCategories() {
  try { return await catalogApi.getCategories(); }
  catch { return []; }
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Bán chạy' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
];

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Dell', 'Asus', 'Lenovo', 'HP'];

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [{ items, meta }, categories] = await Promise.all([
    getProducts(searchParams),
    getCategories(),
  ]);

  const banners = [
    { label: '📱 iPhone 16 Series', sub: 'Từ 22.990.000đ', color: 'from-slate-800 to-slate-900' },
    { label: '💻 MacBook Air M3', sub: 'Mỏng nhẹ – mạnh mẽ', color: 'from-blue-700 to-blue-900' },
    { label: '🎮 Gaming Laptop RTX 4060', sub: 'Chiến game đỉnh cao', color: 'from-purple-700 to-purple-900' },
  ];

  return (
    <div>
      {/* Hero Banner */}
      <section className="container-page pt-6 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div
              key={b.label}
              className={`bg-gradient-to-br ${b.color} text-white rounded-2xl p-6 cursor-pointer
                          hover:scale-[1.02] transition-transform duration-200`}
            >
              <p className="text-lg font-bold">{b.label}</p>
              <p className="text-sm text-white/70 mt-1">{b.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <a
            href="/"
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors
                        ${!searchParams.category ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
          >
            Tất cả
          </a>
          {categories.map((cat: any) => (
            <a
              key={cat.id}
              href={`/?category=${cat.id}`}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors
                          ${searchParams.category === cat.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
            >
              {cat.name}
            </a>
          ))}
        </div>
      </section>

      <div className="container-page pb-12">
        <div className="flex gap-6">
          {/* Sidebar Filter */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="card p-4 sticky top-20">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Bộ lọc
              </h3>

              {/* Price */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Khoảng giá</p>
                <div className="space-y-1">
                  {[
                    { label: 'Dưới 5 triệu', min: '0', max: '5000000' },
                    { label: '5 – 10 triệu', min: '5000000', max: '10000000' },
                    { label: '10 – 20 triệu', min: '10000000', max: '20000000' },
                    { label: 'Trên 20 triệu', min: '20000000', max: '' },
                  ].map((r) => (
                    <a
                      key={r.label}
                      href={`?minPrice=${r.min}&maxPrice=${r.max}`}
                      className="block text-sm text-gray-600 hover:text-blue-600 py-1 transition-colors"
                    >
                      {r.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Brand */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Thương hiệu</p>
                <div className="space-y-1">
                  {BRANDS.map((b) => (
                    <a
                      key={b}
                      href={`?brand=${b}`}
                      className={`block text-sm py-1 transition-colors
                                  ${searchParams.brand === b ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'}`}
                    >
                      {b}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {meta.total > 0 ? `${meta.total} sản phẩm` : 'Không tìm thấy sản phẩm'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 hidden sm:inline">Sắp xếp:</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map((opt) => (
                    <a
                      key={opt.value}
                      href={`?sort=${opt.value}`}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                                  ${searchParams.sort === opt.value || (!searchParams.sort && opt.value === 'newest')
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}
                    >
                      {opt.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Không có sản phẩm nào phù hợp</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                  <a
                    key={p}
                    href={`?page=${p}`}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium
                                border transition-colors
                                ${meta.page === p
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}
                  >
                    {p}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
