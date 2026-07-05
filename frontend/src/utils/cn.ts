import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely — handles conditional classes and conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
