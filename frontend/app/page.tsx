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
    const result = await catalogApi.getProducts({
      categoryId: params.category,
      search: params.search,
      brand: params.brand,
      sort: params.sort || 'newest',
      page: params.page || '1',
      limit: '20',
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
    });
    // Log ngay TẠI ĐÂY (bên trong getProducts), không phải trong HomePage
    // bên dưới — vì HomePage destructure kết quả thành "{ items, meta }"
    // ngay lúc nhận về (xem "Promise.all" trong HomePage), field
    // "_debugVersion" sẽ bị "rớt" mất trong lúc destructure (JS chỉ giữ lại
    // đúng những field được đặt tên, không lỗi gì nhưng không còn truy cập
    // được nữa) — log ở HomePage sẽ không có gì để in ra.
    // Đây là console.log chạy TRONG Server Component (hàm async, không có
    // "use client", không nằm trong useEffect) nên in ra stdout của
    // container frontend, xem được qua:
    //   kubectl logs -f -l app=frontend -n electronics-shop --prefix
    // KHÔNG xuất hiện trong Console của trình duyệt — khác với console.log
    // trong Client Component.
    console.log('[SSR] backend trả về từ bản:', result._debugVersion);
    return result;
  } catch {
    return { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  }
}

async function getCategories() {
  try { return await catalogApi.getCategories(); }
  catch { return []; }
}

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Mới nhất' },
  { value: 'popular',   label: 'Bán chạy' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc',label: 'Giá giảm dần' },
];

const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Dell', 'Asus', 'Lenovo', 'HP', 'Sony'];

const banners = [
  { label: '📱 iPhone 16 Series', sub: 'Từ 22.990.000đ',      color: 'from-slate-700 to-slate-900',   ring: 'ring-slate-600/30' },
  { label: '💻 MacBook Air M3',   sub: 'Mỏng nhẹ – mạnh mẽ', color: 'from-blue-600 to-blue-900',     ring: 'ring-blue-500/30' },
  { label: '🎮 Gaming RTX 4060',  sub: 'Chiến game đỉnh cao', color: 'from-violet-600 to-violet-900', ring: 'ring-violet-500/30' },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [{ items, meta }, categories] = await Promise.all([
    getProducts(params),
    getCategories(),
  ]);

  const pillBase   = 'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors';
  const pillActive = 'bg-blue-600 text-white border-blue-600';
  const pillIdle   = 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400';

  const sortActive = 'bg-blue-600 text-white border-blue-600';
  const sortIdle   = 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-400';

  return (
    <div className="bg-gray-50 dark:bg-[#0d1117] min-h-screen">

      {/* Hero Banner */}
      <section className="container-page pt-6 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div
              key={b.label}
              className={`bg-gradient-to-br ${b.color} text-white rounded-2xl p-6 cursor-pointer
                          ring-1 ${b.ring} hover:scale-[1.02] hover:shadow-xl transition-all duration-200`}
            >
              <p className="text-lg font-bold">{b.label}</p>
              <p className="text-sm text-white/70 mt-1">{b.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category pills */}
      <section className="container-page py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <a href="/" className={`${pillBase} ${!params.category ? pillActive : pillIdle}`}>
            Tất cả
          </a>
          {categories.map((cat: any) => (
            <a
              key={cat.id}
              href={`/?category=${cat.id}`}
              className={`${pillBase} ${params.category === cat.id ? pillActive : pillIdle}`}
            >
              {cat.name}
            </a>
          ))}
        </div>
      </section>

      {/* Main */}
      <div className="container-page pb-12">
        <div className="flex gap-6">

          {/* Sidebar */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="card p-4 sticky top-20">
              <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-4 flex items-center gap-2 text-sm">
                <SlidersHorizontal className="w-4 h-4 text-blue-500" /> Bộ lọc
              </h3>

              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Khoảng giá
                </p>
                <div className="space-y-0.5">
                  {[
                    { label: 'Dưới 5 triệu',  min: '0',        max: '5000000' },
                    { label: '5 – 10 triệu',  min: '5000000',  max: '10000000' },
                    { label: '10 – 20 triệu', min: '10000000', max: '20000000' },
                    { label: 'Trên 20 triệu', min: '20000000', max: '' },
                  ].map((r) => (
                    <a
                      key={r.label}
                      href={`?minPrice=${r.min}&maxPrice=${r.max}`}
                      className="block text-sm rounded px-2 py-1.5 transition-colors
                                 text-gray-600 dark:text-slate-300
                                 hover:text-blue-600 dark:hover:text-blue-400
                                 hover:bg-blue-50 dark:hover:bg-slate-700/50"
                    >
                      {r.label}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Thương hiệu
                </p>
                <div className="space-y-0.5">
                  {BRANDS.map((b) => (
                    <a
                      key={b}
                      href={`?brand=${b}`}
                      className={`block text-sm rounded px-2 py-1.5 transition-colors
                                  ${params.brand === b
                                    ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/40'
                                    : 'text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/50'}`}
                    >
                      {b}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {meta.total > 0 ? `${meta.total} sản phẩm` : 'Không tìm thấy sản phẩm'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-slate-400 hidden sm:inline">Sắp xếp:</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map((opt) => (
                    <a
                      key={opt.value}
                      href={`?sort=${opt.value}`}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                                  ${params.sort === opt.value || (!params.sort && opt.value === 'newest')
                                    ? sortActive : sortIdle}`}
                    >
                      {opt.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-20">
                <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p className="text-gray-400 dark:text-slate-500">Không có sản phẩm nào phù hợp</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

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
                                  : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-400'}`}
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