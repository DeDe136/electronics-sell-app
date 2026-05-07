interface ProductSpecsProps {
  specs: Record<string, string>;
  className?: string;
}

const SPEC_LABELS: Record<string, string> = {
  ram: 'RAM',
  storage: 'Bộ nhớ trong',
  cpu: 'Bộ xử lý',
  gpu: 'Card đồ họa',
  battery: 'Pin',
  screen: 'Màn hình',
  os: 'Hệ điều hành',
  camera: 'Camera',
  chipset: 'Chipset',
  weight: 'Khối lượng',
  color: 'Màu sắc',
  ports: 'Cổng kết nối',
  connectivity: 'Kết nối',
  sim: 'SIM',
};

export function ProductSpecs({ specs, className = '' }: ProductSpecsProps) {
  const entries = Object.entries(specs);
  if (!entries.length) return null;

  return (
    <div className={`bg-gray-50 rounded-xl p-4 ${className}`}>
      <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">
        Thông số kỹ thuật
      </h3>
      <div className="divide-y divide-gray-200">
        {entries.map(([key, value]) => (
          <div key={key} className="flex py-2.5 gap-4">
            <span className="text-sm text-gray-500 w-36 shrink-0">
              {SPEC_LABELS[key] || key}
            </span>
            <span className="text-sm text-gray-800 font-medium flex-1">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
