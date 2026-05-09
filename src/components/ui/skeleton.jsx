import React from 'react';
import { cn } from './cn.js';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-stone-200/60', className)}
      {...props}
    />
  );
}
