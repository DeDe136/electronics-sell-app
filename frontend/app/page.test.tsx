import { render, screen } from '@testing-library/react';
import HomePage from './page';
import { catalogApi } from '@/lib/api';

// HomePage là Server Component (async function) — render trực tiếp
// ProductCard ('use client', dùng zustand + next/image) không cần thiết
// cho test này, nên mock nhẹ để cô lập logic của page.tsx (đúng phần vừa
// thay đổi: gọi catalogApi.getProducts + console.log '_debugVersion').
jest.mock('@/components/product/ProductCard', () => ({
  ProductCard: ({ product }: { product: { id: string; name: string } }) => (
    <div data-testid="product-card">{product.name}</div>
  ),
}));

jest.mock('@/lib/api', () => ({
  catalogApi: {
    getProducts: jest.fn(),
    getCategories: jest.fn(),
  },
}));

const mockedGetProducts = catalogApi.getProducts as jest.Mock;
const mockedGetCategories = catalogApi.getCategories as jest.Mock;

describe('HomePage (app/page.tsx)', () => {
  beforeEach(() => {
    // "page.tsx" hiện có 1 dòng console.log debug tạm thời (log
    // "_debugVersion" để quan sát canary qua SSR) — mock đi để output test
    // không bị rác, KHÔNG assert nội dung log vì đây không phải hành vi
    // nghiệp vụ cần test.
    // ĐÃ XOÁ console.log trong page.tsx? -> có thể xoá luôn dòng jest.spyOn dưới
    // đây, không cần mock console.log nữa.
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockedGetCategories.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gọi catalogApi.getProducts với tham số mặc định (sort=newest, page=1, limit=20)', async () => {
    mockedGetProducts.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });

    const jsx = await HomePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(mockedGetProducts).toHaveBeenCalledWith({
      categoryId: undefined,
      search: undefined,
      brand: undefined,
      sort: 'newest',
      page: '1',
      limit: '20',
      minPrice: undefined,
      maxPrice: undefined,
    });
  });

  it('chuyển tiếp đầy đủ các query param người dùng truyền vào (category, search, brand, sort, page, minPrice, maxPrice)', async () => {
    mockedGetProducts.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 2, limit: 20, totalPages: 1 },
    });

    const jsx = await HomePage({
      searchParams: Promise.resolve({
        category: 'cat-1',
        search: 'iphone',
        brand: 'Apple',
        sort: 'price_asc',
        page: '2',
        minPrice: '1000000',
        maxPrice: '5000000',
      }),
    });
    render(jsx);

    expect(mockedGetProducts).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      search: 'iphone',
      brand: 'Apple',
      sort: 'price_asc',
      page: '2',
      limit: '20',
      minPrice: '1000000',
      maxPrice: '5000000',
    });
  });

  it('render danh sách sản phẩm và tổng số lượng lấy từ meta.total', async () => {
    mockedGetProducts.mockResolvedValue({
      items: [
        { id: 'p1', name: 'Samsung Galaxy S24' },
        { id: 'p2', name: 'iPhone 16' },
      ],
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    });

    const jsx = await HomePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText('2 sản phẩm')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
  });

  it('trả về items rỗng và không throw khi catalogApi.getProducts lỗi (catch block)', async () => {
    mockedGetProducts.mockRejectedValue(new Error('Network error'));

    const jsx = await HomePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByText('Không có sản phẩm nào phù hợp')).toBeInTheDocument();
    expect(screen.getByText('Không tìm thấy sản phẩm')).toBeInTheDocument();
  });

  it('trả về mảng rỗng và không throw khi catalogApi.getCategories lỗi (catch block)', async () => {
    mockedGetProducts.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
    mockedGetCategories.mockRejectedValue(new Error('Network error'));

    const jsx = await HomePage({ searchParams: Promise.resolve({}) });

    // Không throw ra ngoài là đủ để khẳng định catch() hoạt động đúng.
    expect(() => render(jsx)).not.toThrow();
  });
});