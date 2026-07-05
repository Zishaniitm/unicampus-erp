import { cn } from '@/utils/cn'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors duration-150',
        'placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent',
        'disabled:bg-gray-50 disabled:cursor-not-allowed',
        error ? 'border-danger focus:ring-danger/30 focus:border-danger' : 'border-gray-300',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
