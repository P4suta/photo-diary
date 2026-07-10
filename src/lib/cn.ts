import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Conditional Tailwind class join + conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
