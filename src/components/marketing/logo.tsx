import Image from 'next/image';

export function PisairtelLogo({ size = 34 }: { size?: number }) {
  return (
    <Image src="/pisairtel-erp-badge.svg" alt="Pisairtel ERP" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover' }} />
  );
}
