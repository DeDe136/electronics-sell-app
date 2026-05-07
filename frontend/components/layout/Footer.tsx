import Link from 'next/link';
import { Zap, MapPin, Phone, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="container-page py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-xl mb-3">
              <Zap className="w-6 h-6 fill-blue-400 text-blue-400" />
              TechShop
            </div>
            <p className="text-sm leading-relaxed">
              Chuyên cung cấp điện thoại, laptop, tablet chính hãng với giá tốt nhất thị trường.
            </p>
            <div className="flex flex-col gap-2 mt-4 text-sm">
              <span className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" />123 Nguyễn Huệ, Q1, TP.HCM</span>
              <span className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" />1800 1234</span>
              <span className="flex items-center gap-2"><Mail className="w-4 h-4 shrink-0" />support@techshop.vn</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-white font-semibold mb-3">Sản phẩm</h3>
            <ul className="space-y-2 text-sm">
              {['Điện thoại', 'Laptop', 'Tablet', 'Đồng hồ thông minh', 'Phụ kiện'].map((item) => (
                <li key={item}>
                  <Link href={`/?search=${item}`} className="hover:text-white transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-3">Hỗ trợ</h3>
            <ul className="space-y-2 text-sm">
              {['Hướng dẫn mua hàng', 'Chính sách đổi trả', 'Bảo hành', 'Tra cứu đơn hàng', 'FAQs'].map((item) => (
                <li key={item}>
                  <Link href="#" className="hover:text-white transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-3">Về chúng tôi</h3>
            <ul className="space-y-2 text-sm">
              {['Giới thiệu', 'Chính sách bảo mật', 'Điều khoản sử dụng', 'Tuyển dụng'].map((item) => (
                <li key={item}>
                  <Link href="#" className="hover:text-white transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} TechShop. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
}
