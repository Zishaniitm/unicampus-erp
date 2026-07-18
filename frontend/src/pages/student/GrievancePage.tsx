import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import {
  grievanceApi,
  type Grievance,
  type GrievanceCategory,
  type GrievanceStatus,
} from '@/api/grievance.api'
import { formatDate } from '@/utils/format'
import { MessageSquare, Plus, X, Clock, CheckCircle, AlertTriangle, ArrowUpCircle } from 'lucide-react'

const CATEGORY_LABELS: Record<GrievanceCategory, string> = {
  academic:       'Academic',
  financial:      'Financial / Fees',
  administrative: 'Administrative',
  hostel:         'Hostel',
  library:        'Library',
  other:          'Other',
}

export const STATUS_META: Record<GrievanceStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'danger'; icon: React.ReactNode }> = {
  open:      { label: 'Open',        variant: 'info',    icon: <Clock size={13} /> },
  in_review: { label: 'In Review',   variant: 'warning', icon: <AlertTriangle size={13} /> },
  resolved:  { label: 'Resolved',    variant: 'success', icon: <CheckCircle size={13} /> },
  escalated: { label: 'Escalated',   variant: 'danger',  icon: <ArrowUpCircle size={13} /> },
}

// ── Submit modal ───────────────────────────────────────────────
function SubmitGrievanceModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [category, setCategory]       = useState<GrievanceCategory>('academic')
  const [subject, setSubject]         = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors]           = useState<{ subject?: string; description?: string }>({})

  const mutation = useMutation({
    mutationFn: grievanceApi.submit,
    onSuccess: (data) => {
      toast.success(`Grievance submitted. Your ticket number is ${data.ticket_number}`)
      queryClient.invalidateQueries({ queryKey: ['grievances'] })
      onClose()
    },
    onError: () => toast.error('Could not submit your grievance. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (subject.trim().length < 5)      next.subject     = 'Subject must be at least 5 characters'
    if (description.trim().length < 20) next.description = 'Please describe the issue in at least 20 characters'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    mutation.mutate({ category, subject: subject.trim(), description: description.trim() })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Submit a Grievance</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Category" required
            helpText="Your grievance is routed to the right officer based on category">
            <select value={category} onChange={e => setCategory(e.target.value as GrievanceCategory)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-white">
              {(Object.keys(CATEGORY_LABELS) as GrievanceCategory[]).map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Subject" required error={errors.subject}>
            <Input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. CA1 marks not updated for DBMS" maxLength={200} />
          </FormField>

          <FormField label="Description" required error={errors.description}
            helpText={`${description.length}/1000 characters`}>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={5} maxLength={1000}
              placeholder="Describe your grievance in detail — what happened, when, and what resolution you expect…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y" />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>
              <Plus size={16} /> Submit Grievance
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Ticket detail modal (with timeline) ────────────────────────
function TicketDetailModal({ grievanceId, onClose }: { grievanceId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['grievances', 'detail', grievanceId],
    queryFn:  () => grievanceApi.getOne(grievanceId),
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{data?.ticket_number ?? 'Ticket'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {isLoading || !data ? (
            <SkeletonCard />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_META[data.status].variant}>
                  <span className="flex items-center gap-1">{STATUS_META[data.status].icon}{STATUS_META[data.status].label}</span>
                </Badge>
                <Badge variant="neutral">{CATEGORY_LABELS[data.category]}</Badge>
                {data.sla_breached && <Badge variant="danger">SLA Breached</Badge>}
              </div>

              <div>
                <h4 className="font-semibold text-gray-900">{data.subject}</h4>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{data.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Submitted {formatDate(data.created_at)} · Assigned to {data.assigned_role.replace(/_/g, ' ')}
                </p>
              </div>

              {data.resolution_notes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-800 mb-1">Resolution</p>
                  <p className="text-sm text-green-900 whitespace-pre-wrap">{data.resolution_notes}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Ticket History</p>
                <ol className="space-y-3">
                  {data.timeline.map((entry, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                        {i < data.timeline.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">{STATUS_META[entry.new_status]?.label ?? entry.new_status}</span>
                          {entry.comment && <span className="text-gray-600"> — {entry.comment}</span>}
                        </p>
                        <p className="text-xs text-gray-400">{entry.updated_by_name} · {formatDate(entry.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function GrievancePage() {
  const [page, setPage]                 = useState(1)
  const [showSubmit, setShowSubmit]     = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['grievances', 'my', page],
    queryFn:  () => grievanceApi.listMy(page),
  })

  const grievances = data?.grievances ?? []
  const meta       = data?.meta

  return (
    <PageShell title="Grievances">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Grievances</h2>
          <p className="text-sm text-gray-500">Track your submitted tickets and their status</p>
        </div>
        <Button onClick={() => setShowSubmit(true)}>
          <Plus size={16} /> New Grievance
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-danger font-medium">Could not load your grievances</p>
        </div>
      ) : grievances.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <MessageSquare size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No grievances submitted</p>
          <p className="text-sm text-gray-400 mt-1">If you're facing an issue, submit a grievance and we'll route it to the right officer</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {grievances.map((g: Grievance) => (
              <button key={g.grievance_id} onClick={() => setSelectedTicket(g.grievance_id)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:border-accent/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-accent">{g.ticket_number}</span>
                      <Badge variant={STATUS_META[g.status].variant}>
                        <span className="flex items-center gap-1">{STATUS_META[g.status].icon}{STATUS_META[g.status].label}</span>
                      </Badge>
                      {g.sla_breached && <Badge variant="danger">SLA Breached</Badge>}
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1 truncate">{g.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {CATEGORY_LABELS[g.category]} · Submitted {formatDate(g.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {meta && meta.total_pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-gray-500">Page {meta.page} of {meta.total_pages}</span>
              <Button variant="outline" size="sm" disabled={page >= meta.total_pages}
                onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      {showSubmit && <SubmitGrievanceModal onClose={() => setShowSubmit(false)} />}
      {selectedTicket !== null && (
        <TicketDetailModal grievanceId={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </PageShell>
  )
}
