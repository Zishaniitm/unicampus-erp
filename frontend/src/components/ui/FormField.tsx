import { cn } from '@/utils/cn'
import type { ReactNode } from 'react'

interface FormFieldProps {
  label:     string
  error?:    string
  helpText?: string
  required?: boolean
  children:  ReactNode
  className?: string
}

/** Wraps every input with label, error message, and help text */
export function FormField({ label, error, helpText, required, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-danger flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          {error}
        </p>
      )}
      {helpText && !error && <p className="text-xs text-gray-500">{helpText}</p>}
    </div>
  )
}
