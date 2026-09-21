import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductCard } from './ProductCard';

const addItemMock = jest.fn();

jest.mock('@/lib/hooks/useCart', () => ({
  useCart: () => ({ addItem: addItemMock }),
}));

describe('ProductCard', () => {
  const baseProduct = {
    id: 'product-1',
    name: 'iPhone 16 Pro Max',
    slug: 'iphone-16-pro-max',
    brand: 'Apple',
    price: 30000000,
    images: [{ url: 'https://example.com/iphone.jpg' }],
    specs: { ram: '8GB', storage: '256GB', cpu: 'A18 Pro' },
    soldCount: 1234,
    category: { name: 'Điện thoại' },
  };

  beforeEach(() => {
    addItemMock.mockClear();
  });

  it('renders the product name, brand, and formatted price', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText('iPhone 16 Pro Max')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText(/30\.000\.000/)).toBeInTheDocument();
  });

  it('shows only the first two specs as chips', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText('8GB')).toBeInTheDocument();
    expect(screen.getByText('256GB')).toBeInTheDocument();
    expect(screen.queryByText('A18 Pro')).not.toBeInTheDocument();
  });

  it('shows a discount badge and the crossed-out original price when there is a sale', () => {
    render(<ProductCard product={{ ...baseProduct, salePrice: 27000000 }} />);

    expect(screen.getByText('-10%')).toBeInTheDocument();
    expect(screen.getByText(/27\.000\.000/)).toBeInTheDocument();
  });

  it('does not show a discount badge when there is no sale price', () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it('shows a placeholder when there is no image', () => {
    render(<ProductCard product={{ ...baseProduct, images: [] }} />);

    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  describe('unoptimized image loading — chỉ tắt Next.js Image Optimization cho ảnh qua proxy "/api/images/"', () => {
    // Next.js Image thật (không mock) sẽ tự lộ ra ngoài DOM: khi
    // "unoptimized" bật, thuộc tính src giữ NGUYÊN url gốc và KHÔNG có
    // srcset; khi tắt (mặc định), src bị viết lại thành
    // "/_next/image?url=...&w=...&q=..." kèm srcset resize nhiều size.
    // Test dựa vào khác biệt quan sát được này thay vì đọc prop React nội
    // bộ, vì component không expose prop đó ra bất kỳ đâu khác.

    it('TẮT optimize (unoptimized) khi ảnh đến từ route proxy "/api/images/..." — tránh lỗi hairpin trên EKS', () => {
      render(
        <ProductCard
          product={{
            ...baseProduct,
            images: [{ url: '/api/images/products/abc-123.png' }],
          }}
        />,
      );

      const img = screen.getByAltText('iPhone 16 Pro Max');
      expect(img).toHaveAttribute('src', '/api/images/products/abc-123.png');
      expect(img).not.toHaveAttribute('srcset');
    });

    it('VẪN BẬT optimize như bình thường cho ảnh URL tuyệt đối (vd MinIO local) — không đổi hành vi cũ', () => {
      render(
        <ProductCard
          product={{
            ...baseProduct,
            images: [{ url: 'http://minio:9000/electronics-shop/abc.png' }],
          }}
        />,
      );

      const img = screen.getByAltText('iPhone 16 Pro Max');
      expect(img.getAttribute('src')).toMatch(/^\/_next\/image\?url=/);
      expect(img).toHaveAttribute('srcset');
    });
  });

  it('calls addItem with quantity 1 when clicking the add-to-cart button', async () => {
    const user = userEvent.setup();
    render(<ProductCard product={baseProduct} />);

    await user.click(screen.getByRole('button', { name: /Thêm/i }));

    expect(addItemMock).toHaveBeenCalledWith('product-1', 1);
  });

  it('formats the sold count with thousands grouping', () => {
    render(<ProductCard product={baseProduct} />);

    // Dấu phân cách nghìn của toLocaleString() có thể khác nhau tùy locale
    // của môi trường chạy test (vd: 1.234 hoặc 1,234) nên regex chấp nhận cả hai.
    expect(screen.getByText(/Đã bán 1[.,]234/)).toBeInTheDocument();
  });
});
