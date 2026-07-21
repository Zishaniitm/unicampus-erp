import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import {
  hostelApi, busApi,
  type HostelCategory, type BusRoute, type RegStatus, type RegistrationWindowInfo,
} from '@/api/hostelbus.api'
import { formatPaise } from '@/api/fee.api'
import { formatDate } from '@/utils/format'
import { Home, Bus, X, Clock } from 'lucide-react'

const STATUS_VARIANT: Record<RegStatus, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending:   'warning',
  approved:  'success',
  rejected:  'danger',
  cancelled: 'neutral',
}

function WindowBanner({ window, label }: { window: RegistrationWindowInfo | null; label: string }) {
  if (!window) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-500 mb-4">
        <Clock size={14} className="inline mr-1.5 -mt-0.5" />
        {label} registration window has not been announced yet
      </div>
    )
  }
  const now = Date.now()
  const open = window.is_active && now >= new Date(window.opens_at).getTime() && now <= new Date(window.closes_at).getTime()
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-sm mb-4 ${
      open ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
      <Clock size={14} className="inline mr-1.5 -mt-0.5" />
      {open
        ? `${label} registration is OPEN until ${formatDate(window.closes_at)}`
        : now < new Date(window.opens_at).getTime()
          ? `${label} registration opens ${formatDate(window.opens_at)}`
          : `${label} registration closed on ${formatDate(window.closes_at)}`}
    </div>
  )
}

// ── Hostel apply modal ─────────────────────────────────────────
function HostelApplyModal({ categories, onClose }: { categories: HostelCategory[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const available = categories.filter(c => c.available > 0)
  const [categoryId, setCategoryId] = useState(available[0]?.category_id ?? 0)
  const [remarks, setRemarks] = useState('')

  const mutation = useMutation({
    mutationFn: () => hostelApi.apply({ category_id: categoryId, remarks: remarks.trim() || undefined }),
    onSuccess: () => {
      toast.success('Hostel application submitted — pending approval.')
      queryClient.invalidateQueries({ queryKey: ['hostelbus'] })
      onClose()
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code
      const messages: Record<string, string> = {
        'ERR-HST-001': 'The registration window is not open.',
        'ERR-HST-002': 'This category is full or unavailable.',
        'ERR-HST-003': 'You already have an active registration this year.',
      }
      toast.error(messages[code] ?? 'Could not submit your application.')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Apply for Hostel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (categoryId) mutation.mutate() }} className="p-6 space-y-4">
          <FormField label="Room Category" required>
            <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              {available.map(c => (
                <option key={c.category_id} value={c.category_id}>
                  {c.category_name} — {formatPaise(c.fee_per_semester_paise)}/sem ({c.available} left)
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Remarks" helpText="Optional — e.g. roommate preference">
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} maxLength={500}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending} disabled={!available.length}>Apply</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Bus apply modal ────────────────────────────────────────────
function BusApplyModal({ routes, onClose }: { routes: BusRoute[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const available = routes.filter(r => r.available > 0)
  const [routeId, setRouteId] = useState(available[0]?.route_id ?? 0)
  const selectedRoute = available.find(r => r.route_id === routeId)
  const [stop, setStop] = useState(selectedRoute?.stops[0] ?? '')

  const mutation = useMutation({
    mutationFn: () => busApi.apply({ route_id: routeId, stop_name: stop }),
    onSuccess: () => {
      toast.success('Bus pass application submitted — pending approval.')
      queryClient.invalidateQueries({ queryKey: ['hostelbus'] })
      onClose()
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code
      toast.error(code === 'ERR-BUS-001'
        ? 'The registration window is not open.'
        : 'Could not submit — the route may be full or you already applied.')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Apply for Bus Pass</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (routeId && stop) mutation.mutate() }} className="p-6 space-y-4">
          <FormField label="Route" required>
            <select value={routeId}
              onChange={e => {
                const id = Number(e.target.value)
                setRouteId(id)
                setStop(available.find(r => r.route_id === id)?.stops[0] ?? '')
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              {available.map(r => (
                <option key={r.route_id} value={r.route_id}>
                  {r.route_name} — {formatPaise(r.fee_per_semester_paise)}/sem ({r.available} seats)
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Boarding Stop" required>
            <select value={stop} onChange={e => setStop(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              {(selectedRoute?.stops ?? []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending} disabled={!available.length}>Apply</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Shared registration status card ───────────────────────────
function RegistrationCard({ title, status, subtitle, detail }: {
  title: string; status: RegStatus; subtitle: string; detail?: string | null
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
        </div>
        <Badge variant={STATUS_VARIANT[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function HostelBusPage({ mode }: { mode: 'hostel' | 'bus' }) {
  const [showApply, setShowApply] = useState(false)

  const { data: hostelData, isLoading: hostelLoading } = useQuery({
    queryKey: ['hostelbus', 'hostel-my'],
    queryFn:  hostelApi.getMy,
    enabled:  mode === 'hostel',
  })
  const { data: categories } = useQuery({
    queryKey: ['hostelbus', 'categories'],
    queryFn:  hostelApi.listCategories,
    enabled:  mode === 'hostel',
  })
  const { data: busData, isLoading: busLoading } = useQuery({
    queryKey: ['hostelbus', 'bus-my'],
    queryFn:  busApi.getMy,
    enabled:  mode === 'bus',
  })
  const { data: routes } = useQuery({
    queryKey: ['hostelbus', 'routes'],
    queryFn:  busApi.listRoutes,
    enabled:  mode === 'bus',
  })

  const isHostel = mode === 'hostel'
  const isLoading = isHostel ? hostelLoading : busLoading
  const windowInfo = isHostel ? hostelData?.window : busData?.window
  const registrations = (isHostel ? hostelData?.registrations : busData?.registrations) ?? []
  const hasLive = registrations.some(r => r.status === 'pending' || r.status === 'approved')

  return (
    <PageShell title={isHostel ? 'Hostel' : 'Bus'}>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {isHostel ? 'Hostel Registration' : 'Bus Pass Registration'}
          </h2>
          <p className="text-sm text-gray-500">
            {isHostel ? 'Apply for a hostel room for this academic year' : 'Apply for a college bus pass'}
          </p>
        </div>
        {!hasLive && (
          <Button onClick={() => setShowApply(true)}>
            {isHostel ? <Home size={16} /> : <Bus size={16} />} Apply
          </Button>
        )}
      </div>

      <WindowBanner window={windowInfo ?? null} label={isHostel ? 'Hostel' : 'Bus'} />

      {isLoading ? (
        <div className="grid gap-3">{[...Array(2)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : registrations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          {isHostel ? <Home size={36} className="text-gray-300 mx-auto mb-2" /> : <Bus size={36} className="text-gray-300 mx-auto mb-2" />}
          <p className="text-gray-500 font-medium">No registration yet</p>
          <p className="text-sm text-gray-400 mt-1">Apply while the window is open</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {registrations.map((r: any) => (
            <RegistrationCard key={r.registration_id}
              title={isHostel ? r.category_name : `${r.route_name} — ${r.stop_name}`}
              status={r.status}
              subtitle={`${formatPaise(r.fee_per_semester_paise)}/semester · Applied ${formatDate(r.created_at)}`}
              detail={r.status === 'rejected' && r.remarks ? `Reason: ${r.remarks}` : null}
            />
          ))}
        </div>
      )}

      {/* Availability listing */}
      <div className="mt-8">
        <h3 className="font-semibold text-gray-900 mb-3">{isHostel ? 'Room Categories' : 'Routes'}</h3>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {(isHostel ? categories ?? [] : routes ?? []).map((item: any) => (
            <div key={isHostel ? item.category_id : item.route_id}
              className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {isHostel ? item.category_name : item.route_name}
                </p>
                <p className="text-xs text-gray-500">
                  {isHostel
                    ? `${item.gender} · ${formatPaise(item.fee_per_semester_paise)}/semester`
                    : `${(item.stops ?? []).join(' → ')} · ${formatPaise(item.fee_per_semester_paise)}/semester`}
                </p>
              </div>
              <Badge variant={item.available > 0 ? 'success' : 'danger'}>
                {item.available > 0 ? `${item.available} available` : 'Full'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {showApply && isHostel && categories && (
        <HostelApplyModal categories={categories} onClose={() => setShowApply(false)} />
      )}
      {showApply && !isHostel && routes && (
        <BusApplyModal routes={routes} onClose={() => setShowApply(false)} />
      )}
    </PageShell>
  )
}
