import React from 'react';
import { cn } from './cn.js';

const VARIANTS = {
  default: 'bg-stone-900 text-white hover:bg-stone-800',
  outline: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50',
  ghost: 'text-stone-700 hover:bg-stone-100',
  accent: 'bg-orange-600 text-white hover:bg-orange-700',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

const SIZES = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-10 px-6 text-base',
  icon: 'h-9 w-9',
};

export const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400',
        VARIANTS[variant] || VARIANTS.default,
        SIZES[size] || SIZES.default,
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
