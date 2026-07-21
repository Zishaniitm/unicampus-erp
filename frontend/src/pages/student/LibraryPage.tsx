import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { libraryApi, type LibraryBook, type MyIssue } from '@/api/library.api'
import { formatPaise } from '@/api/fee.api'
import { formatDate } from '@/utils/format'
import { BookOpen, Search, AlertTriangle } from 'lucide-react'

export function LibraryPage() {
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery]   = useState('')

  const { data: myData } = useQuery({
    queryKey: ['library', 'my-issued'],
    queryFn:  libraryApi.getMyIssues,
  })

  const { data: catalogue, isLoading } = useQuery({
    queryKey: ['library', 'books', page, query],
    queryFn:  () => libraryApi.listBooks(page, query || undefined),
  })

  const activeIssues = (myData?.issues ?? []).filter(i => i.status === 'issued')

  return (
    <PageShell title="Library">
      {/* My issued books */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">My Books</h2>
        <p className="text-sm text-gray-500 mb-3">
          {activeIssues.length} issued
          {myData && myData.unpaid_fines_paise > 0 && (
            <span className="text-danger font-medium"> · Unpaid fines: {formatPaise(myData.unpaid_fines_paise)}</span>
          )}
        </p>

        {activeIssues.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <BookOpen size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No books currently issued</p>
            <p className="text-sm text-gray-400 mt-1">Browse the catalogue below and visit the library counter to borrow</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeIssues.map((issue: MyIssue) => (
              <div key={issue.issue_id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${issue.overdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                      {issue.overdue && (
                        <Badge variant="danger">
                          <span className="flex items-center gap-1"><AlertTriangle size={12} /> Overdue</span>
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{issue.author}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Issued {formatDate(issue.issue_date)} · Due {formatDate(issue.due_date)}
                    </p>
                  </div>
                  {issue.overdue && issue.estimated_fine_paise > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Fine so far</p>
                      <p className="text-sm font-bold text-danger">{formatPaise(issue.estimated_fine_paise)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalogue */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-lg font-bold text-gray-900">Book Catalogue</h2>
          <form onSubmit={e => { e.preventDefault(); setQuery(search); setPage(1) }} className="flex gap-2">
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search title, author, ISBN…" className="w-64" />
            <Button type="submit" variant="secondary" size="sm"><Search size={15} /></Button>
          </form>
        </div>

        {isLoading ? (
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
                      {b.author}{b.category ? ` · ${b.category}` : ''}{b.rack_number ? ` · Rack ${b.rack_number}` : ''}
                    </p>
                  </div>
                  <Badge variant={b.available_copies > 0 ? 'success' : 'danger'}>
                    {b.available_copies > 0 ? `${b.available_copies} available` : 'Out of stock'}
                  </Badge>
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
      </div>
    </PageShell>
  )
}
