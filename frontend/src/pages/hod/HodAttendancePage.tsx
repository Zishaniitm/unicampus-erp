import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { attendanceApi } from '@/api/attendance.api'
import { AlertTriangle, Users, TrendingDown } from 'lucide-react'

interface BatchStudent {
  student_id:       number
  roll_number:      string
  name:             string
  total_classes:    number
  effective_present: number
  absent:           number
  percentage:       number
  alert:            boolean
}

export function HodAttendancePage() {
  const [batchId,   setBatchId]   = useState<number>(1)
  const [fromDate,  setFromDate]  = useState('')
  const [toDate,    setToDate]    = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'batch', batchId, fromDate, toDate],
    queryFn:  () => attendanceApi.getBatchSummary(
      batchId,
      fromDate || undefined,
      toDate   || undefined,
    ),
    enabled: !!batchId,
  })

  const students: BatchStudent[] = (data ?? []) as BatchStudent[]
  const below75  = students.filter((s: BatchStudent) => s.percentage < 75).length
  const below60  = students.filter((s: BatchStudent) => s.percentage < 60).length
  const avgPct   = students.length
    ? (students.reduce((sum: number, s: BatchStudent) => sum + s.percentage, 0) / students.length).toFixed(1)
    : '—'

  return (
    <PageShell title="Batch Attendance">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Batch Attendance Summary</h2>
        <p className="text-sm text-gray-500">Students sorted by attendance — lowest first</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Batch ID</label>
          <input type="number" value={batchId} min={1}
            onChange={e => setBatchId(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg w-24 focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && students.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Students', value: students.length, icon: <Users size={16} className="text-accent" />,         color: 'bg-blue-50   border-blue-100'   },
            { label: 'Average %',      value: `${avgPct}%`,    icon: <TrendingDown size={16} className="text-purple-600" />, color: 'bg-purple-50 border-purple-100' },
            { label: 'Below 75%',      value: below75,          icon: <AlertTriangle size={16} className="text-warning" />, color: 'bg-amber-50  border-amber-100'  },
            { label: 'Below 60%',      value: below60,          icon: <AlertTriangle size={16} className="text-danger" />,  color: 'bg-red-50    border-red-100'    },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 border shadow-sm ${s.color}`}>
              <div className="flex items-center gap-1.5 mb-1">{s.icon}<p className="text-xs text-gray-500">{s.label}</p></div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Student table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Roll No</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-1 text-center">Total</div>
          <div className="col-span-1 text-center">Present</div>
          <div className="col-span-1 text-center">Absent</div>
          <div className="col-span-2 text-center">Percentage</div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            No attendance data for this batch
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((s: BatchStudent, idx: number) => {
              const pct     = s.percentage
              const color   = pct >= 75 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-danger'
              const variant = (pct >= 75 ? 'success' : pct >= 60 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger'
              return (
                <div key={s.student_id}
                  className={`grid grid-cols-12 gap-2 px-5 py-3 items-center text-sm ${pct < 60 ? 'bg-red-50/30' : ''}`}>
                  <div className="col-span-1 text-gray-400 text-xs">{idx + 1}</div>
                  <div className="col-span-2 font-mono text-xs text-gray-600">{s.roll_number}</div>
                  <div className="col-span-4 font-medium text-gray-800 truncate">{s.name}</div>
                  <div className="col-span-1 text-center text-gray-500 text-xs">{s.total_classes}</div>
                  <div className="col-span-1 text-center text-success text-xs font-medium">{s.effective_present}</div>
                  <div className="col-span-1 text-center text-danger text-xs font-medium">{s.absent}</div>
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <span className={`text-sm font-bold ${color}`}>{pct.toFixed(1)}%</span>
                    {pct < 75 && <Badge variant={variant}>{pct < 60 ? 'Critical' : 'Low'}</Badge>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}
