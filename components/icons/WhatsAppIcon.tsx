import Image from 'next/image';

interface WhatsAppIconProps {
  className?: string;
  size?: number;
}

export function WhatsAppIcon({ className, size = 20 }: WhatsAppIconProps) {
  return (
    <Image
      src="/whatsapp-icon.png"
      alt="WhatsApp"
      width={size}
      height={size}
      className={className}
    />
  );
}
