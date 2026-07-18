import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { noticeApi, type Notice } from '@/api/notice.api'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/utils/format'
import { Bell, AlertCircle, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'

const POSTER_ROLES = ['SUPER_ADMIN', 'PRINCIPAL', 'HOD', 'STAFF']

// ── Notice card ────────────────────────────────────────────────
function NoticeCard({ notice, onOpen }: { notice: Notice; onOpen: (n: Notice) => void }) {
  const [expanded, setExpanded] = useState(false)

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !notice.is_read) onOpen(notice)
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${
      notice.is_critical ? 'border-red-200' : 'border-gray-100'
    }`}>
      <button onClick={toggle} className="w-full text-left p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              notice.is_critical ? 'bg-red-50' : 'bg-blue-50'
            }`}>
              {notice.is_critical
                ? <AlertCircle size={18} className="text-danger" />
                : <Bell size={18} className="text-accent" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold text-gray-900 ${!notice.is_read ? '' : 'font-medium'}`}>
                  {notice.title}
                </h3>
                {!notice.is_read && <span className="w-2 h-2 rounded-full bg-accent shrink-0" title="Unread" />}
                {notice.is_critical && <Badge variant="danger">Critical</Badge>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {notice.posted_by} · {formatDate(notice.created_at)}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-gray-400 mt-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-0">
          <div className="ml-12 text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-3">
            {notice.body}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Post-notice modal (staff/HOD/admin only) ───────────────────
function PostNoticeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [isCritical, setIsCritical] = useState(false)
  const [targetRole, setTargetRole] = useState('')
  const [errors, setErrors]         = useState<{ title?: string; body?: string }>({})

  const mutation = useMutation({
    mutationFn: noticeApi.create,
    onSuccess: () => {
      toast.success('Notice posted successfully.')
      queryClient.invalidateQueries({ queryKey: ['notices'] })
      onClose()
    },
    onError: () => toast.error('Could not post the notice. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (title.trim().length < 3)  next.title = 'Title must be at least 3 characters'
    if (body.trim().length  < 10) next.body  = 'Body must be at least 10 characters'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    mutation.mutate({
      title: title.trim(),
      body:  body.trim(),
      is_critical: isCritical,
      ...(targetRole ? { target_role: targetRole } : {}),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Post a Notice</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Title" required error={errors.title}>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Mid-semester exam schedule released" maxLength={200} />
          </FormField>

          <FormField label="Notice Body" required error={errors.body}>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              rows={5} placeholder="Write the full notice content here…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent resize-y" />
          </FormField>

          <FormField label="Target Audience" helpText="Leave as 'Everyone' to show the notice to all roles">
            <select value={targetRole} onChange={e => setTargetRole(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-white">
              <option value="">Everyone</option>
              <option value="STUDENT">Students only</option>
              <option value="TEACHER">Teachers only</option>
              <option value="STAFF">Staff only</option>
            </select>
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isCritical} onChange={e => setIsCritical(e.target.checked)}
              className="rounded border-gray-300 text-accent focus:ring-accent/40" />
            <span className="text-sm text-gray-700">Mark as <span className="font-semibold text-danger">critical</span> (pinned to top, triggers notifications)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>
              <Plus size={16} /> Post Notice
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function NoticesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showPostModal, setShowPostModal] = useState(false)

  const canPost = user?.role && POSTER_ROLES.includes(user.role)

  const { data, isLoading, error } = useQuery({
    queryKey: ['notices', page],
    queryFn:  () => noticeApi.list(page),
  })

  const markReadMutation = useMutation({
    mutationFn: noticeApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  })

  const notices = data?.notices ?? []
  const meta    = data?.meta

  return (
    <PageShell title="Notices">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Notice Board</h2>
          <p className="text-sm text-gray-500">
            College announcements and circulars
            {meta?.unread ? <span className="ml-1 text-accent font-medium">· {meta.unread} unread</span> : null}
          </p>
        </div>
        {canPost && (
          <Button onClick={() => setShowPostModal(true)}>
            <Plus size={16} /> Post Notice
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-danger font-medium">Could not load notices</p>
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Bell size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No notices yet</p>
          <p className="text-sm text-gray-400 mt-1">Announcements from the college will appear here</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {notices.map(notice => (
              <NoticeCard key={notice.notice_id} notice={notice}
                onOpen={n => markReadMutation.mutate(n.notice_id)} />
            ))}
          </div>

          {/* Pagination */}
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

      {showPostModal && <PostNoticeModal onClose={() => setShowPostModal(false)} />}
    </PageShell>
  )
}
