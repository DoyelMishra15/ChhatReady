import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-strong',
        sun: 'bg-sun text-ink hover:bg-sun-strong hover:text-white',
        secondary: 'border border-line bg-surface text-ink hover:border-ink/40',
        quiet: 'text-primary hover:bg-primary-soft',
        ghost: 'text-ink hover:bg-ink/5',
        danger: 'bg-danger text-white hover:opacity-90'
      },
      size: { sm: 'min-h-10 px-3.5 text-sm', md: 'min-h-11 px-5 text-[15px]', lg: 'min-h-[52px] px-6 text-base' }
    },
    defaultVariants: { variant: 'primary', size: 'md' }
  }
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ variant, size, loading, className, children, disabled, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size, className, ...rest }: LinkProps & VariantProps<typeof buttonVariants>) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...rest} />;
}
