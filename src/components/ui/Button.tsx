import React from 'react';
import { Loader2Icon } from 'lucide-react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 border border-brand-600 hover:border-brand-700',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:bg-canvas hover:text-ink',
  danger: 'bg-danger text-white border border-danger hover:bg-danger-ink hover:border-danger-ink'
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium',
        'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className
      )}>
      
      {loading ? <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>);

}