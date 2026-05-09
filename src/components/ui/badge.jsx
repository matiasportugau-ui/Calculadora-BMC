import React from 'react';
import { cn } from './cn.js';

const VARIANTS = {
  default: 'bg-stone-100 text-stone-700 border-stone-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  accent: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium',
        VARIANTS[variant] || VARIANTS.default,
        className
      )}
      {...props}
    />
  );
}
