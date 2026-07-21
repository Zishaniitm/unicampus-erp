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
  libraryApi, type LibraryBook, type IssuedListEntry,
} from '@/api/library.api'
import { formatPaise } from '@/api/fee.api'
import { formatDate } from '@/utils/format'
import { Plus, X, Search, BookUp, BookDown, AlertTriangle } from 'lucide-react'

// ── Modal shell ────────────────────────────────────────────────
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

// ── Add book modal ─────────────────────────────────────────────
function AddBookModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ title: '', author: '', isbn: '', category: '', copies: '1', rack: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => libraryApi.createBook({
      title: form.title.trim(),
      author: form.author.trim(),
      total_copies: parseInt(form.copies, 10) || 1,
      isbn: form.isbn.trim() || undefined,
      category: form.category.trim() || undefined,
      rack_number: form.rack.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Book added to catalogue.')
      queryClient.invalidateQueries({ queryKey: ['library'] })
      onClose()
    },
    onError: () => toast.error('Could not add the book. ISBN may already exist.'),
  })

  return (
    <ModalShell title="Add Book" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (form.title.trim().length >= 2 && form.author.trim().length >= 2) mutation.mutate() }}
        className="p-6 space-y-4">
        <FormField label="Title" required>
          <Input value={form.title} onChange={set('title')} placeholder="Database System Concepts" maxLength={300} />
        </FormField>
        <FormField label="Author" required>
          <Input value={form.author} onChange={set('author')} placeholder="Silberschatz, Korth" maxLength={200} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="ISBN">
            <Input value={form.isbn} onChange={set('isbn')} placeholder="9780078022159" maxLength={20} />
          </FormField>
          <FormField label="Category">
            <Input value={form.category} onChange={set('category')} placeholder="Programming" maxLength={50} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Copies" required>
            <Input type="number" min="1" max="1000" value={form.copies} onChange={set('copies')} />
          </FormField>
          <FormField label="Rack">
            <Input value={form.rack} onChange={set('rack')} placeholder="A-12" maxLength={20} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><Plus size={16} /> Add Book</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Issue book modal ───────────────────────────────────────────
function IssueBookModal({ book, onClose }: { book: LibraryBook; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [studentId, setStudentId] = useState('')

  const mutation = useMutation({
    mutationFn: () => libraryApi.issueBook({ book_id: book.book_id, student_id: parseInt(studentId, 10) }),
    onSuccess: (d) => {
      toast.success(`Issued. Due ${formatDate(d.due_date)}`)
      queryClient.invalidateQueries({ queryKey: ['library'] })
      onClose()
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code
      const messages: Record<string, string> = {
        'ERR-LIB-001': 'No copies available.',
        'ERR-LIB-002': 'Student has unpaid fines above the limit.',
        'ERR-LIB-004': 'Student already has the maximum books issued.',
        'ERR-STU-005': 'Student not found — check the ID.',
      }
      toast.error(messages[code] ?? 'Could not issue the book.')
    },
  })

  return (
    <ModalShell title={`Issue: ${book.title}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (studentId) mutation.mutate() }} className="p-6 space-y-4">
        <FormField label="Student ID" required helpText="14-day loan from today">
          <Input type="number" value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="e.g. 3" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><BookUp size={16} /> Issue</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function LibraryManagementPage() {
  const queryClient = useQueryClient()
  const [tab, setTab]       = useState<'issued' | 'catalogue'>('issued')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery]   = useState('')
  const [modal, setModal]   = useState<'add' | null>(null)
  const [issueBook, setIssueBook] = useState<LibraryBook | null>(null)

  const { data: issued, isLoading: issuedLoading } = useQuery({
    queryKey: ['library', 'issued', overdueOnly],
    queryFn:  () => libraryApi.getIssuedList(overdueOnly),
    enabled:  tab === 'issued',
  })

  const { data: catalogue, isLoading: catLoading } = useQuery({
    queryKey: ['library', 'books', page, query],
    queryFn:  () => libraryApi.listBooks(page, query || undefined),
    enabled:  tab === 'catalogue',
  })

  const returnMutation = useMutation({
    mutationFn: (issueId: number) => libraryApi.returnBook({ issue_id: issueId }),
    onSuccess: (d) => {
      toast.success(d.fine_paise > 0
        ? `Returned. Fine created: ${formatPaise(d.fine_paise)}`
        : 'Returned. No fine.')
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
    onError: () => toast.error('Could not process the return.'),
  })

  return (
    <PageShell title="Library Management">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Library Administration</h2>
          <p className="text-sm text-gray-500">Catalogue, issue/return, and fines</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setModal('add')}><Plus size={15} /> Add Book</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'issued' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('issued')}>
          Issued Books
        </Button>
        <Button variant={tab === 'catalogue' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('catalogue')}>
          Catalogue
        </Button>
      </div>

      {tab === 'issued' ? (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
            Show overdue only
          </label>

          {issuedLoading ? (
            <div className="grid gap-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : !issued?.length ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-gray-500 font-medium">{overdueOnly ? 'No overdue books' : 'No books currently issued'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {issued.map((i: IssuedListEntry) => (
                <div key={i.issue_id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{i.title}</p>
                      {i.overdue && (
                        <Badge variant="danger">
                          <span className="flex items-center gap-1"><AlertTriangle size={12} /> Overdue · {formatPaise(i.estimated_fine_paise)}</span>
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {i.student_name} ({i.roll_number}) · Issued {formatDate(i.issue_date)} · Due {formatDate(i.due_date)}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" loading={returnMutation.isPending}
                    onClick={() => returnMutation.mutate(i.issue_id)}>
                    <BookDown size={15} /> Return
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <form onSubmit={e => { e.preventDefault(); setQuery(search); setPage(1) }} className="flex gap-2 mb-3">
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search title, author, ISBN…" className="w-64" />
            <Button type="submit" variant="secondary" size="sm"><Search size={15} /></Button>
          </form>

          {catLoading ? (
            <div className="grid gap-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : !catalogue?.books.length ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-gray-500 font-medium">No books found</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {catalogue.books.map((b: LibraryBook) => (
                  <div key={b.book_id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{b.title}</p>
                      <p className="text-xs text-gray-500">
                        {b.author}{b.isbn ? ` · ${b.isbn}` : ''}{b.rack_number ? ` · Rack ${b.rack_number}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={b.available_copies > 0 ? 'success' : 'danger'}>
                        {b.available_copies}/{b.total_copies}
                      </Badge>
                      <Button size="sm" variant="outline" disabled={b.available_copies < 1}
                        onClick={() => setIssueBook(b)}>
                        <BookUp size={15} /> Issue
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {catalogue.meta.total_pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-gray-500">Page {catalogue.meta.page} of {catalogue.meta.total_pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= catalogue.meta.total_pages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {modal === 'add' && <AddBookModal onClose={() => setModal(null)} />}
      {issueBook && <IssueBookModal book={issueBook} onClose={() => setIssueBook(null)} />}
    </PageShell>
  )
}
