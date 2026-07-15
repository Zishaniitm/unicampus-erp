import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { attendanceApi } from '@/api/attendance.api'
import { formatTime } from '@/utils/format'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Stethoscope, Briefcase } from 'lucide-react'

type Status = 'P' | 'A' | 'ML' | 'DL'

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  P:  { label: 'Present',       color: 'text-green-700',   bg: 'bg-green-100 border-green-300',   icon: <CheckCircle size={14} /> },
  A:  { label: 'Absent',        color: 'text-red-700',     bg: 'bg-red-100 border-red-300',       icon: <XCircle size={14} /> },
  ML: { label: 'Medical Leave', color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300',     icon: <Stethoscope size={14} /> },
  DL: { label: 'Duty Leave',    color: 'text-purple-700',  bg: 'bg-purple-100 border-purple-300', icon: <Briefcase size={14} /> },
}

export function MarkAttendancePage() {
  const [searchParams] = useSearchParams()
  const entryId = parseInt(searchParams.get('entry') ?? '0', 10)
  const date    = searchParams.get('date') ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const queryClient = useQueryClient()
  const [statuses, setStatuses] = useState<Record<number, Status>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'roster', entryId, date],
    queryFn:  () => attendanceApi.getRoster(entryId, date),
    enabled:  !!entryId,
  })

  // Pre-fill existing records when data loads (TanStack Query v5 — use useEffect)
  useEffect(() => {
    if (!data) return
    const existing: Record<number, Status> = {}
    data.students.forEach(s => { if (s.status) existing[s.student_id] = s.status as Status })
    setStatuses(existing)
  }, [data])

  const { mutate: submitAttendance, isPending: submitting } = useMutation({
    mutationFn: () => attendanceApi.markAttendance({
      timetable_entry_id: entryId,
      att_date: date,
      records: Object.entries(statuses).map(([sid, status]) => ({
        student_id: parseInt(sid, 10), status,
      })),
    }),
    onSuccess: () => {
      toast.success('Attendance saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['attendance', 'roster', entryId, date] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save attendance')
    },
  })

  function markAllPresent() {
    if (!data) return
    const all: Record<number, Status> = {}
    data.students.forEach(s => { all[s.student_id] = 'P' })
    setStatuses(all)
  }

  const markedCount  = Object.keys(statuses).length
  const total        = data?.students.length ?? 0
  const presentCount = Object.values(statuses).filter(s => s === 'P').length
  const absentCount  = Object.values(statuses).filter(s => s === 'A').length

  if (!entryId) {
    return (
      <PageShell title="Mark Attendance">
        <div className="text-center py-12">
          <p className="text-gray-500">Select a class from your timetable to mark attendance.</p>
          <a href="/timetable" className="mt-3 inline-block text-accent hover:underline text-sm">
            Go to Timetable →
          </a>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Mark Attendance">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-danger">Class not found.</div>
      ) : (
        <>
          {/* Class info header */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{data.entry.course_name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {data.entry.course_code} · {data.entry.day_of_week} ·{' '}
                  {formatTime(data.entry.start_time)} – {formatTime(data.entry.end_time)}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Date: <span className="font-medium text-gray-700">{date}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-accent">{markedCount}/{total}</p>
                <p className="text-xs text-gray-500">marked</p>
              </div>
            </div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${total ? (markedCount / total) * 100 : 0}%` }} />
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              <CheckCircle size={15} /> Mark All Present
            </Button>
            <span className="text-sm text-gray-500">
              {presentCount} present · {absentCount} absent
            </span>
            {data.already_marked && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg">
                Previously saved — you can update
              </span>
            )}
          </div>

          {/* Student roster */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="divide-y divide-gray-50">
              {data.students.map((student, idx) => {
                const current = statuses[student.student_id] ?? null
                return (
                  <div key={student.student_id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-6 text-center text-xs text-gray-400 shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-400">{student.roll_number}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['P', 'A', 'ML', 'DL'] as Status[]).map(s => {
                        const cfg      = STATUS_CONFIG[s]
                        const selected = current === s
                        return (
                          <button key={s}
                            onClick={() => setStatuses(prev => ({ ...prev, [student.student_id]: s }))}
                            title={cfg.label}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                              selected
                                ? `${cfg.bg} ${cfg.color} shadow-sm scale-105`
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                            }`}>
                            {cfg.icon}{s}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Submit bar */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4 sticky bottom-4">
            <p className="text-sm text-gray-600">
              {markedCount < total ? (
                <span className="text-warning font-medium">{total - markedCount} students not yet marked</span>
              ) : (
                <span className="text-success font-medium flex items-center gap-1">
                  <CheckCircle size={14} /> All students marked
                </span>
              )}
            </p>
            <Button onClick={() => submitAttendance()} loading={submitting} disabled={markedCount === 0}>
              Save Attendance
            </Button>
          </div>
        </>
      )}
    </PageShell>
  )
}
