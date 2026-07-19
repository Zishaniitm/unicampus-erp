import { PageShell } from '@/components/layout/PageShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { formatTime, getTodayName } from '@/utils/format'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { TimetableEntry } from '@/api/timetable.api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface TimeSlot {
  time_slot_id: number
  slot_name:    string
  start_time:   string
  end_time:     string
}

export function TimetablePage() {
  const today = getTodayName()
  const { user } = useAuth()
  // Teachers/HODs see their own teaching schedule; students see their batch timetable
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'HOD'

  const { data, isLoading, error } = useQuery({
    queryKey: ['timetable', isTeacher ? 'teacher-my' : 'my'],
    queryFn:  async () => {
      const res = await api.get(isTeacher ? '/timetable/teacher/my' : '/timetable/my')
      return res.data.data as {
        batch_name?:    string
        academic_year?: string
        semester?:      number
        entries:        (TimetableEntry & { batch_name?: string })[]
        time_slots?:    TimeSlot[]
      }
    },
  })

  // Group entries by day
  const byDay = (day: string) =>
    (data?.entries ?? []).filter(e => e.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <PageShell title="Timetable">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{isTeacher ? 'My Teaching Schedule' : 'Weekly Timetable'}</h2>
          {data?.batch_name && (
            <p className="text-sm text-gray-500">
              {data.batch_name} · Semester {data.semester} · {data.academic_year}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download size={15} />
          Download PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : error ? (
  <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
    <p className="text-gray-500 font-medium">No timetable data available</p>
    <p className="text-sm text-gray-400 mt-1">Timetable entries will appear here once configured by HOD</p>
  </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map(day => {
            const classes = byDay(day)
            const isToday = day === today

            return (
              <div key={day} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isToday ? 'border-accent' : 'border-gray-100'}`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b ${isToday ? 'bg-accent/5 border-accent/20' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-sm ${isToday ? 'text-accent' : 'text-gray-700'}`}>{day}</h3>
                    {isToday && <Badge variant="info">Today</Badge>}
                  </div>
                  <span className="text-xs text-gray-400">{classes.length} class{classes.length !== 1 ? 'es' : ''}</span>
                </div>

                {/* Classes */}
                {classes.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400">No classes</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {classes.map((cls, i) => (
                      <div key={i} className={`flex items-start gap-4 px-5 py-3 ${cls.is_cancelled ? 'opacity-50' : ''}`}>
                        {/* Time */}
                        <div className="text-center min-w-[60px] shrink-0">
                          <p className="text-xs font-semibold text-accent">{formatTime(cls.start_time)}</p>
                          <p className="text-xs text-gray-400">{formatTime(cls.end_time)}</p>
                        </div>

                        {/* Color bar */}
                        <div className={`w-1 self-stretch rounded-full shrink-0 ${cls.is_cancelled ? 'bg-gray-300' : 'bg-accent'}`} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{cls.course_name}</p>
                            <Badge variant="neutral">{cls.course_code}</Badge>
                            {cls.is_cancelled && <Badge variant="danger">Cancelled</Badge>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {cls.teacher_name} · {cls.classroom_name}, {cls.building}
                          </p>
                          {cls.is_cancelled && cls.cancel_reason && (
                            <p className="text-xs text-danger mt-0.5">Reason: {cls.cancel_reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
