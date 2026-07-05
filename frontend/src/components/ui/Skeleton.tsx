import { cn } from '@/utils/cn'

interface SkeletonProps { className?: string }

/** Pulsing skeleton for content loading states — never show a blank screen */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse bg-gray-200 rounded-md', className)} />
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}
