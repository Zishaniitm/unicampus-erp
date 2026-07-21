import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import {
  hostelApi, busApi,
  type PendingHostelEntry, type PendingBusEntry,
} from '@/api/hostelbus.api'
import { formatDate } from '@/utils/format'
import { X, Check, Ban, Plus, CalendarClock } from 'lucide-react'

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Reject modal (shared) ──────────────────────────────────────
function RejectModal({ onSubmit, onClose }: { onSubmit: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <ModalShell title="Reject Application" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (reason.trim().length >= 5) onSubmit(reason.trim()) }}
        className="p-6 space-y-4">
        <FormField label="Rejection Reason" required helpText="Shown to the student (min 5 characters)">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger"><Ban size={15} /> Reject</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Create category modal ──────────────────────────────────────
function CreateCategoryModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'Male' | 'Female' | 'Any'>('Any')
  const [capacity, setCapacity] = useState('')
  const [feeRupees, setFeeRupees] = useState('')

  const mutation = useMutation({
    mutationFn: () => hostelApi.createCategory({
      category_name: name.trim(),
      gender,
      total_capacity: parseInt(capacity, 10),
      fee_per_semester_paise: Math.round(parseFloat(feeRupees) * 100),
    }),
    onSuccess: () => {
      toast.success('Hostel category created.')
      queryClient.invalidateQueries({ queryKey: ['hostelbus'] })
      onClose()
    },
    onError: () => toast.error('Could not create the category. Name may already exist.'),
  })

  return (
    <ModalShell title="New Hostel Category" onClose={onClose}>
      <form onSubmit={e => {
        e.preventDefault()
        if (name.trim().length >= 3 && parseInt(capacity, 10) >= 0 && parseFloat(feeRupees) >= 0) mutation.mutate()
      }} className="p-6 space-y-4">
        <FormField label="Category Name" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="2-Seater AC" maxLength={80} />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Gender" required>
            <select value={gender} onChange={e => setGender(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              <option value="Any">Any</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </FormField>
          <FormField label="Capacity" required>
            <Input type="number" min="0" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="40" />
          </FormField>
          <FormField label="Fee/sem (₹)" required>
            <Input type="number" min="0" step="0.01" value={feeRupees} onChange={e => setFeeRupees(e.target.value)} placeholder="25000" />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><Plus size={15} /> Create</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Create route modal ─────────────────────────────────────────
function CreateRouteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [stops, setStops] = useState('')
  const [capacity, setCapacity] = useState('')
  const [feeRupees, setFeeRupees] = useState('')

  const mutation = useMutation({
    mutationFn: () => busApi.createRoute({
      route_name: name.trim(),
      stops: stops.split(',').map(s => s.trim()).filter(Boolean),
      capacity: parseInt(capacity, 10),
      fee_per_semester_paise: Math.round(parseFloat(feeRupees) * 100),
    }),
    onSuccess: () => {
      toast.success('Bus route created.')
      queryClient.invalidateQueries({ queryKey: ['hostelbus'] })
      onClose()
    },
    onError: () => toast.error('Could not create the route. Name may already exist.'),
  })

  return (
    <ModalShell title="New Bus Route" onClose={onClose}>
      <form onSubmit={e => {
        e.preventDefault()
        if (name.trim().length >= 3 && stops.trim() && parseInt(capacity, 10) >= 0) mutation.mutate()
      }} className="p-6 space-y-4">
        <FormField label="Route Name" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Route 1 — City Centre" maxLength={100} />
        </FormField>
        <FormField label="Stops" required helpText="Comma-separated, in order">
          <textarea value={stops} onChange={e => setStops(e.target.value)} rows={2}
            placeholder="Civil Lines, Katra, University Gate"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Capacity" required>
            <Input type="number" min="0" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="50" />
          </FormField>
          <FormField label="Fee/sem (₹)" required>
            <Input type="number" min="0" step="0.01" value={feeRupees} onChange={e => setFeeRupees(e.target.value)} placeholder="8000" />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><Plus size={15} /> Create</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Set window modal (SUPER_ADMIN) ─────────────────────────────
function SetWindowModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<'hostel' | 'bus' | 'semester'>('hostel')
  const [year, setYear] = useState('2026-2027')
  const [opens, setOpens] = useState('')
  const [closes, setCloses] = useState('')

  const mutation = useMutation({
    mutationFn: () => hostelApi.setWindow({
      window_type: type,
      academic_year: year,
      opens_at:  new Date(opens).toISOString(),
      closes_at: new Date(closes).toISOString(),
    }),
    onSuccess: () => {
      toast.success('Registration window saved.')
      queryClient.invalidateQueries({ queryKey: ['hostelbus'] })
      onClose()
    },
    onError: () => toast.error('Could not save the window. Check the dates.'),
  })

  return (
    <ModalShell title="Set Registration Window" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (opens && closes && year.match(/^\d{4}-\d{4}$/)) mutation.mutate() }}
        className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type" required>
            <select value={type} onChange={e => setType(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              <option value="hostel">Hostel</option>
              <option value="bus">Bus</option>
              <option value="semester">Semester</option>
            </select>
          </FormField>
          <FormField label="Academic Year" required>
            <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2026-2027" />
          </FormField>
        </div>
        <FormField label="Opens At" required>
          <Input type="datetime-local" value={opens} onChange={e => setOpens(e.target.value)} />
        </FormField>
        <FormField label="Closes At" required>
          <Input type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><CalendarClock size={15} /> Save Window</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function HostelBusManagementPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'hostel' | 'bus'>('hostel')
  const [modal, setModal] = useState<'category' | 'route' | 'window' | null>(null)
  const [rejecting, setRejecting] = useState<{ id: number; type: 'hostel' | 'bus' } | null>(null)

  const { data: hostelPending, isLoading: hLoading } = useQuery({
    queryKey: ['hostelbus', 'hostel-pending'],
    queryFn:  hostelApi.listPending,
    enabled:  tab === 'hostel',
  })
  const { data: busPending, isLoading: bLoading } = useQuery({
    queryKey: ['hostelbus', 'bus-pending'],
    queryFn:  busApi.listPending,
    enabled:  tab === 'bus',
  })

  const decideMutation = useMutation({
    mutationFn: (args: { type: 'hostel' | 'bus'; registration_id: number; decision: 'approved' | 'rejected'; remarks?: string }) =>
      args.type === 'hostel'
        ? hostelApi.decide(args)
        : busApi.decide(args),
    onSuccess: (_d, args) => {
      toast.success(args.decision === 'approved' ? 'Application approved.' : 'Application rejected.')
      queryClient.invalidateQueries({ queryKey: ['hostelbus'] })
      setRejecting(null)
    },
    onError: () => toast.error('Could not process the application.'),
  })

  const pending = tab === 'hostel' ? hostelPending : busPending
  const isLoading = tab === 'hostel' ? hLoading : bLoading

  return (
    <PageShell title="Hostel & Bus">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Hostel & Bus Administration</h2>
          <p className="text-sm text-gray-500">Process applications, manage categories, routes and windows</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setModal('category')}><Plus size={15} /> Category</Button>
          <Button variant="outline" size="sm" onClick={() => setModal('route')}><Plus size={15} /> Route</Button>
          {user?.role === 'SUPER_ADMIN' && (
            <Button variant="outline" size="sm" onClick={() => setModal('window')}><CalendarClock size={15} /> Windows</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'hostel' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('hostel')}>
          Hostel Queue {hostelPending?.length ? `(${hostelPending.length})` : ''}
        </Button>
        <Button variant={tab === 'bus' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('bus')}>
          Bus Queue {busPending?.length ? `(${busPending.length})` : ''}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : !pending?.length ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Check size={36} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">Queue is clear</p>
          <p className="text-sm text-gray-400 mt-1">No pending {tab} applications</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {pending.map((p: PendingHostelEntry | PendingBusEntry) => (
            <div key={p.registration_id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {'category_name' in p ? p.category_name : `${p.route_name} — ${p.stop_name}`}
                </p>
                <p className="text-xs text-gray-500">
                  {p.student_name} ({p.roll_number}) · Applied {formatDate(p.created_at)}
                </p>
                {'remarks' in p && p.remarks && (
                  <p className="text-xs text-gray-400 mt-0.5">Note: {p.remarks}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => decideMutation.mutate({
                  type: tab, registration_id: p.registration_id, decision: 'approved',
                })} loading={decideMutation.isPending}>
                  <Check size={15} /> Approve
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => setRejecting({ id: p.registration_id, type: tab })}>
                  <Ban size={15} /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'category' && <CreateCategoryModal onClose={() => setModal(null)} />}
      {modal === 'route' && <CreateRouteModal onClose={() => setModal(null)} />}
      {modal === 'window' && <SetWindowModal onClose={() => setModal(null)} />}
      {rejecting && (
        <RejectModal
          onClose={() => setRejecting(null)}
          onSubmit={reason => decideMutation.mutate({
            type: rejecting.type, registration_id: rejecting.id, decision: 'rejected', remarks: reason,
          })}
        />
      )}
    </PageShell>
  )
}
