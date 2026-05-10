// Tiny class name combiner — avoids pulling clsx/tailwind-merge for now.
export function cn(...args) {
  return args.filter(Boolean).join(' ');
}
