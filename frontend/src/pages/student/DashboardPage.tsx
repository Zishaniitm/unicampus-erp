import { useAuth } from '@/hooks/useAuth'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { getTodayName, formatTime, formatCurrency } from '@/utils/format'
import { Clock, CreditCard, Bell, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { attendanceApi } from '@/api/attendance.api'
import type { AttendanceSummary } from '@/api/attendance.api'

// ── Attendance Widget ──────────────────────────────────────────
function AttendanceWidget() {
  const { user } = useAuth()
  const isStudent = user?.role === 'STUDENT'

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'summary'],
    queryFn:  attendanceApi.getMySummary,
    staleTime: 5 * 60 * 1000,
    enabled:  isStudent,  // only fetch for students
    retry:    false,      // don't retry on 403
  })

  if (isLoading) return <SkeletonCard />

  const subjects: AttendanceSummary[] = data ?? []
  const lowAttendance = subjects.filter(s => s.percentage < 75)

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Attendance</h3>
        <a href="/attendance" className="text-xs text-accent hover:underline">View all →</a>
      </div>

      {subjects.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No attendance data yet</p>
      ) : (
        <>
          {lowAttendance.length > 0 && (
            <div className="mb-3 flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-danger shrink-0" />
              <p className="text-xs text-danger font-medium">
                {lowAttendance.length} subject{lowAttendance.length > 1 ? 's' : ''} below 75%
              </p>
            </div>
          )}
          <div className="space-y-3">
            {subjects.slice(0, 5).map(s => {
              const color = s.percentage >= 75 ? '#059669' : s.percentage >= 65 ? '#D97706' : '#E11D48'
              return (
                <div key={s.course_code}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 truncate max-w-[200px]" title={s.course_name}>
                      {s.course_name}
                    </span>
                    <span className="text-sm font-bold ml-2 shrink-0" style={{ color }}>
                      {s.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(s.percentage, 100)}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
            {subjects.length > 5 && (
              <p className="text-xs text-gray-400 text-center">+{subjects.length - 5} more subjects</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Fee Card ───────────────────────────────────────────────────
function FeeCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['fee', 'balance'],
    queryFn:  async () => {
      const res = await api.get('/fee/my/balance')
      return res.data.data as { balance_due: number; fine_accrued: number; last_payment_date: string | null }
    },
  })

  if (isLoading) return <SkeletonCard />

  const due   = data?.balance_due  ?? 0
  const fine  = data?.fine_accrued ?? 0
  const total = due + fine
  const hasdue = total > 0

  return (
    <div className={`rounded-xl p-5 shadow-sm border h-full ${hasdue ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className={hasdue ? 'text-danger' : 'text-success'} />
          <h3 className="font-semibold text-gray-800">Fee Status</h3>
        </div>
        {!hasdue && <CheckCircle size={18} className="text-success" />}
      </div>
      {hasdue ? (
        <>
          <p className="text-2xl font-bold text-danger">{formatCurrency(total)}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Fees: {formatCurrency(due)} + Fine: {formatCurrency(fine)}
          </p>
          <a href="/fees" className="mt-3 inline-flex items-center px-4 py-1.5 bg-danger text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            Pay Now →
          </a>
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-success">All Clear</p>
          <p className="text-xs text-gray-500 mt-0.5">No pending dues</p>
        </>
      )}
    </div>
  )
}

// ── Today's Classes ────────────────────────────────────────────
function TodayClasses() {
  const today = getTodayName()
  const { data, isLoading } = useQuery({
    queryKey: ['timetable', 'today'],
    queryFn:  async () => {
      const res = await api.get('/timetable/today')
      return res.data.data as Array<{
        start_time: string; end_time: string; course_name: string
        teacher_name: string; classroom_name: string; building: string; is_cancelled: boolean
      }>
    },
  })

  if (isLoading) return <SkeletonCard />

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-accent" />
          <h3 className="font-semibold text-gray-800">Today — {today}</h3>
        </div>
        <a href="/timetable" className="text-xs text-accent hover:underline">Full timetable →</a>
      </div>
      {(!data || data.length === 0) ? (
        <p className="text-sm text-gray-400 text-center py-6">No classes scheduled today</p>
      ) : (
        <div className="space-y-2">
          {data.map((cls, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
              cls.is_cancelled ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-blue-50 border-blue-100'
            }`}>
              <div className="text-center min-w-[56px]">
                <p className="text-xs font-semibold text-accent">{formatTime(cls.start_time)}</p>
                <p className="text-xs text-gray-400">{formatTime(cls.end_time)}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {cls.course_name}
                  {cls.is_cancelled && <span className="ml-2 text-xs text-danger">[Cancelled]</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {cls.teacher_name} · {cls.classroom_name}, {cls.building}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Notices Widget ─────────────────────────────────────────────
function NoticesWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['notices', 'recent'],
    queryFn:  async () => {
      const res = await api.get('/notices?per_page=3')
      return res.data.data as Array<{ notice_id: number; title: string; posted_by: string; is_critical: boolean }>
    },
  })

  if (isLoading) return <SkeletonCard />

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-warning" />
          <h3 className="font-semibold text-gray-800">Recent Notices</h3>
        </div>
        <a href="/notices" className="text-xs text-accent hover:underline">View all →</a>
      </div>
      {(!data || data.length === 0) ? (
        <p className="text-sm text-gray-400 text-center py-4">No new notices</p>
      ) : (
        <ul className="space-y-2">
          {data.map(n => (
            <li key={n.notice_id} className="flex items-start gap-2 text-sm">
              {n.is_critical && <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />}
              <div>
                <p className="text-gray-800 font-medium leading-snug">{n.title}</p>
                <p className="text-xs text-gray-400">{n.posted_by}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Library Card ───────────────────────────────────────────────
function LibraryCard() {
  const { data } = useQuery({
    queryKey: ['library', 'my'],
    queryFn:  async () => {
      const res = await api.get('/library/my/issued')
      return res.data.data as Array<{ title: string; due_date: string; days_left: number }>
    },
  })

  const issued = data ?? []

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-purple-600" />
          <h3 className="font-semibold text-gray-800">Library</h3>
        </div>
        <a href="/library" className="text-xs text-accent hover:underline">View →</a>
      </div>
      {issued.length === 0 ? (
        <p className="text-sm text-gray-400">No books currently issued</p>
      ) : (
        <ul className="space-y-2">
          {issued.map((b, i) => (
            <li key={i} className="text-sm">
              <p className="text-gray-800 truncate font-medium">{b.title}</p>
              <p className={`text-xs ${b.days_left <= 2 ? 'text-danger' : 'text-gray-400'}`}>
                {b.days_left <= 0 ? `Overdue by ${Math.abs(b.days_left)} days` : `Due in ${b.days_left} days`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────
export function StudentDashboardPage() {
  const { user } = useAuth()
  const firstName = user?.first_name ?? user?.username ?? 'there'

  return (
    <PageShell title="Dashboard">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Good {getGreeting()}, {firstName} 👋
        </h2>
        <p className="text-gray-500 text-sm mt-0.5">Here's what's happening at college today.</p>
      </div>

      {/* Priority grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <div className="xl:col-span-2"><AttendanceWidget /></div>
        <div><FeeCard /></div>
        <div><LibraryCard /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TodayClasses />
        <NoticesWidget />
      </div>
    </PageShell>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
