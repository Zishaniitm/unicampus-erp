import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import {
  grievanceApi,
  type Grievance,
  type GrievanceCategory,
  type GrievanceStatus,
} from '@/api/grievance.api'
import { STATUS_META } from '@/pages/student/GrievancePage'
import { formatDate } from '@/utils/format'
import { Inbox, X } from 'lucide-react'

const CATEGORY_LABELS: Record<GrievanceCategory, string> = {
  academic:       'Academic',
  financial:      'Financial / Fees',
  administrative: 'Administrative',
  hostel:         'Hostel',
  library:        'Library',
  other:          'Other',
}

// ── Resolve / update modal ─────────────────────────────────────
function UpdateTicketModal({ grievance, onClose }: { grievance: Grievance; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [status, setStatus]     = useState<'in_review' | 'resolved'>(
    grievance.status === 'open' ? 'in_review' : 'resolved',
  )
  const [comment, setComment]   = useState('')
  const [notes, setNotes]       = useState('')
  const [notesError, setNotesError] = useState<string | undefined>()

  const { data: detail } = useQuery({
    queryKey: ['grievances', 'detail', grievance.grievance_id],
    queryFn:  () => grievanceApi.getOne(grievance.grievance_id),
  })

  const mutation = useMutation({
    mutationFn: () => grievanceApi.updateStatus(grievance.grievance_id, {
      status,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(status === 'resolved' ? { resolution_notes: notes.trim() } : {}),
    }),
    onSuccess: () => {
      toast.success(status === 'resolved' ? 'Ticket resolved.' : 'Ticket moved to In Review.')
      queryClient.invalidateQueries({ queryKey: ['grievances'] })
      onClose()
    },
    onError: () => toast.error('Could not update the ticket. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'resolved' && notes.trim().length < 10) {
      setNotesError('Resolution notes must be at least 10 characters')
      return
    }
    setNotesError(undefined)
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{grievance.ticket_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Ticket summary */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={STATUS_META[grievance.status].variant}>{STATUS_META[grievance.status].label}</Badge>
              <Badge variant="neutral">{CATEGORY_LABELS[grievance.category]}</Badge>
              {grievance.sla_breached && <Badge variant="danger">SLA Breached</Badge>}
            </div>
            <h4 className="font-semibold text-gray-900">{grievance.subject}</h4>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{grievance.description}</p>
            <p className="text-xs text-gray-400 mt-2">
              {grievance.student_name} ({grievance.roll_number}) · Submitted {formatDate(grievance.created_at)}
              {' '}· SLA due {formatDate(grievance.sla_due_at)}
            </p>
          </div>

          {/* Timeline so far */}
          {detail && detail.timeline.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">History</p>
              <ul className="space-y-1.5">
                {detail.timeline.map((entry, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    <span className="font-medium">{STATUS_META[entry.new_status]?.label ?? entry.new_status}</span>
                    {entry.comment && <> — {entry.comment}</>}
                    <span className="text-gray-400"> · {entry.updated_by_name}, {formatDate(entry.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action form */}
          <form onSubmit={handleSubmit} className="space-y-4 border-t border-gray-100 pt-4">
            <FormField label="Action" required>
              <select value={status} onChange={e => setStatus(e.target.value as 'in_review' | 'resolved')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-white">
                <option value="in_review">Move to In Review</option>
                <option value="resolved">Resolve Ticket</option>
              </select>
            </FormField>

            {status === 'in_review' && (
              <FormField label="Comment" helpText="Visible to the student in the ticket history">
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                  placeholder="e.g. Looking into this with the exam cell…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y" />
              </FormField>
            )}

            {status === 'resolved' && (
              <FormField label="Resolution Notes" required error={notesError}
                helpText="Recorded permanently and shown to the student">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Describe how this grievance was resolved…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y" />
              </FormField>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={mutation.isPending}
                variant={status === 'resolved' ? 'primary' : 'secondary'}>
                {status === 'resolved' ? 'Resolve Ticket' : 'Update Status'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function GrievanceQueuePage() {
  const [page, setPage]             = useState(1)
  const [statusFilter, setStatusFilter] = useState<GrievanceStatus | ''>('')
  const [selected, setSelected]     = useState<Grievance | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['grievances', 'assigned', page, statusFilter],
    queryFn:  () => grievanceApi.listAssigned(page, statusFilter || undefined),
  })

  const grievances = data?.grievances ?? []
  const meta       = data?.meta

  return (
    <PageShell title="Grievance Queue">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Assigned Grievances</h2>
          <p className="text-sm text-gray-500">Tickets routed to your role — SLA-breached tickets appear first</p>
        </div>
        <select value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as GrievanceStatus | ''); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 bg-white">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In Review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-danger font-medium">Could not load the grievance queue</p>
        </div>
      ) : grievances.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Inbox size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Queue is clear</p>
          <p className="text-sm text-gray-400 mt-1">No grievances match the current filter</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {grievances.map((g: Grievance) => (
              <button key={g.grievance_id} onClick={() => setSelected(g)}
                className={`bg-white rounded-xl border shadow-sm p-5 text-left hover:border-accent/40 transition-all ${
                  g.sla_breached ? 'border-red-200' : 'border-gray-100'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-accent">{g.ticket_number}</span>
                      <Badge variant={STATUS_META[g.status].variant}>{STATUS_META[g.status].label}</Badge>
                      <Badge variant="neutral">{CATEGORY_LABELS[g.category]}</Badge>
                      {g.sla_breached && <Badge variant="danger">SLA Breached</Badge>}
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-1 truncate">{g.subject}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {g.student_name} ({g.roll_number}) · {formatDate(g.created_at)} · SLA due {formatDate(g.sla_due_at)}
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

      {selected && <UpdateTicketModal grievance={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  )
}
