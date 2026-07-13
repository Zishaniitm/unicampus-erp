import { useQuery } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { attendanceApi } from '@/api/attendance.api'
import { AlertTriangle, CheckCircle, BookOpen } from 'lucide-react'

function AttendanceBar({ pct }: { pct: number }) {
  const color  = pct >= 75 ? '#059669' : pct >= 65 ? '#D97706' : '#E11D48'
  const bg     = pct >= 75 ? 'bg-green-50 border-green-200' : pct >= 65 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  return (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

export function AttendancePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance', 'summary'],
    queryFn:  attendanceApi.getMySummary,
  })

  const subjects = data ?? []
  const belowThreshold = subjects.filter(s => s.percentage < 75)
  const overallPct = subjects.length > 0
    ? subjects.reduce((sum, s) => sum + s.percentage, 0) / subjects.length
    : null

  return (
    <PageShell title="Attendance">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Attendance</h2>
          <p className="text-sm text-gray-500">Subject-wise breakdown for current semester</p>
        </div>
        {overallPct !== null && (
          <div className={`px-4 py-2 rounded-xl border text-center ${overallPct >= 75 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-2xl font-bold" style={{ color: overallPct >= 75 ? '#059669' : '#E11D48' }}>
              {overallPct.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">Overall</p>
          </div>
        )}
      </div>

      {/* Alert banner for below-75% subjects */}
      {belowThreshold.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger">Attendance Warning</p>
            <p className="text-sm text-red-700 mt-0.5">
              You are below 75% in {belowThreshold.length} subject{belowThreshold.length > 1 ? 's' : ''}: {' '}
              <span className="font-medium">{belowThreshold.map(s => s.course_code).join(', ')}</span>.
              Attend more classes to avoid exam eligibility issues.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-danger font-medium">Could not load attendance data</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No attendance records yet</p>
          <p className="text-sm text-gray-400 mt-1">Your attendance will appear here once classes begin</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {subjects.map(subject => {
            const pct     = subject.percentage
            const variant = pct >= 75 ? 'success' : pct >= 65 ? 'warning' : 'danger'
            const color   = pct >= 75 ? '#059669' : pct >= 65 ? '#D97706' : '#E11D48'

            return (
              <div key={subject.course_code}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{subject.course_name}</h3>
                      <Badge variant="neutral">{subject.course_code}</Badge>
                      {pct < 75 && <Badge variant="danger">Low</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {subject.present} present · {subject.absent} absent
                      {subject.medical_leave > 0 && ` · ${subject.medical_leave} ML`}
                      {subject.duty_leave   > 0 && ` · ${subject.duty_leave} DL`}
                      {' '}of {subject.total} classes
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xl font-bold" style={{ color }}>{pct.toFixed(1)}%</p>
                    {pct >= 75
                      ? <CheckCircle size={14} className="text-success ml-auto" />
                      : <AlertTriangle size={14} className="text-danger ml-auto" />
                    }
                  </div>
                </div>

                <AttendanceBar pct={pct} />

                {/* Classes needed to reach 75% */}
                {pct < 75 && subject.total > 0 && (() => {
                  const needed = Math.ceil((0.75 * subject.total - (subject.present + subject.medical_leave + subject.duty_leave)) / 0.25)
                  return needed > 0 ? (
                    <p className="text-xs text-danger mt-2">
                      Attend next <span className="font-semibold">{needed} consecutive classes</span> to reach 75%
                    </p>
                  ) : null
                })()}
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
