import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Penggabung className: `clsx` untuk kondisional, `tailwind-merge` untuk konflik utility. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
