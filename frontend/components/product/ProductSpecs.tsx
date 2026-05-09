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
    <div className={`rounded-xl p-4
      bg-gray-50 dark:bg-slate-800/60
      border border-gray-100 dark:border-slate-700/50
      ${className}`}>
      <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide
        text-gray-800 dark:text-slate-100">
        Thông số kỹ thuật
      </h3>
      <div className="divide-y divide-gray-200 dark:divide-slate-700/60">
        {entries.map(([key, value]) => (
          <div key={SPEC_LABELS[key] || key} className="flex py-2.5 gap-4">
            <span className="text-sm w-36 shrink-0 text-gray-500 dark:text-slate-400">
              {SPEC_LABELS[key] || key}
            </span>
            <span className="text-sm font-medium flex-1 text-gray-800 dark:text-slate-100">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}