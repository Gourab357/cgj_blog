import { LOGO_SRC } from '@/lib/site';

type CGJLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizes = {
  sm: 'h-10 w-10 border-2',
  md: 'h-11 w-11 border-[3px]',
  lg: 'h-14 w-14 border-[3px]',
};

export function CGJLogo({ size = 'md', className = '' }: CGJLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="Centre for Gender Justice logo"
      className={`rounded-full border-[#ef765d] object-cover bg-[#10223c] ${sizes[size]} ${className}`}
    />
  );
}
