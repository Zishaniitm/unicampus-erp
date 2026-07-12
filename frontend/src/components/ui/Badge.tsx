import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const variants: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger:  'bg-red-100  text-red-800',
  info:    'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
}

interface BadgeProps {
  variant?:  BadgeVariant
  children:  ReactNode
  className?: string
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
