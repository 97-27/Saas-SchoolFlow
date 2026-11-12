import { BrandLoader } from '@/components/ui/brand-loader';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <BrandLoader />
    </div>
  );
}
