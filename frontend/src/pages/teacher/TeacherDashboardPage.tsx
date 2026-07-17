import { useAuth } from '@/hooks/useAuth'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatTime, getTodayName } from '@/utils/format'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useNavigate } from 'react-router-dom'
import { Clock, UserCheck, CheckCircle, Calendar } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface TimetableEntry {
  entry_id:       number
  day_of_week:    string
  start_time:     string
  end_time:       string
  slot_name:      string
  course_name:    string
  course_code:    string
  classroom_name: string
  building:       string
  batch_name:     string
  is_cancelled:   boolean
}

export function TeacherDashboardPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const today     = getTodayName()

  const { data, isLoading } = useQuery({
    queryKey: ['timetable', 'teacher'],
    queryFn:  async () => {
      const res = await api.get('/timetable/teacher/my')
      return res.data.data as { entries: TimetableEntry[] }
    },
  })

  const todayClasses  = (data?.entries ?? []).filter(e => e.day_of_week === today && !e.is_cancelled)
  const totalClasses  = data?.entries?.length ?? 0

  function goMarkAttendance(entryId: number) {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    navigate(`/attendance/mark?entry=${entryId}&date=${date}`)
  }

  return (
    <PageShell title="Dashboard">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Good {getGreeting()}, {user?.first_name ?? user?.username} 👋
        </h2>
        <p className="text-gray-500 text-sm mt-0.5">Here's your teaching schedule.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Today's Classes", value: todayClasses.length, icon: <Clock size={18} className="text-accent" />, color: 'bg-blue-50 border-blue-100' },
          { label: 'Weekly Classes',  value: totalClasses,        icon: <Calendar size={18} className="text-purple-600" />, color: 'bg-purple-50 border-purple-100' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl p-4 border shadow-sm ${stat.color}`}>
            <div className="flex items-center gap-2 mb-1">{stat.icon}<p className="text-xs text-gray-500">{stat.label}</p></div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Today's classes with Mark Attendance buttons */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-accent" />
            <h3 className="font-semibold text-gray-800">Today — {today}</h3>
          </div>
          <Badge variant={todayClasses.length > 0 ? 'info' : 'neutral'}>
            {todayClasses.length} class{todayClasses.length !== 1 ? 'es' : ''}
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : todayClasses.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CheckCircle size={32} className="text-success mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No classes today</p>
            <p className="text-sm text-gray-400 mt-1">Enjoy your free day!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayClasses
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map(cls => (
                <div key={cls.entry_id} className="flex items-center gap-4 px-5 py-4">
                  {/* Time */}
                  <div className="text-center min-w-[64px] shrink-0">
                    <p className="text-sm font-bold text-accent">{formatTime(cls.start_time)}</p>
                    <p className="text-xs text-gray-400">{formatTime(cls.end_time)}</p>
                  </div>

                  {/* Color bar */}
                  <div className="w-1 h-12 rounded-full bg-accent shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{cls.course_name}</p>
                      <Badge variant="neutral">{cls.course_code}</Badge>
                      <Badge variant="info">{cls.batch_name}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cls.classroom_name}, {cls.building}
                    </p>
                  </div>

                  {/* Mark attendance button */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => goMarkAttendance(cls.entry_id)}
                    className="shrink-0"
                  >
                    <UserCheck size={14} />
                    Mark Attendance
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Full week schedule */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800">Weekly Schedule</h3>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {DAYS.map(day => {
              const dayClasses = (data?.entries ?? [])
                .filter(e => e.day_of_week === day)
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
              const isToday = day === today

              return (
                <div key={day} className={`px-5 py-3 ${isToday ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-sm font-semibold ${isToday ? 'text-accent' : 'text-gray-600'}`}>{day}</p>
                    {isToday && <Badge variant="info">Today</Badge>}
                    {dayClasses.length === 0 && <p className="text-xs text-gray-400">No classes</p>}
                  </div>
                  {dayClasses.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {dayClasses.map(cls => (
                        <div key={cls.entry_id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                            cls.is_cancelled ? 'bg-gray-50 border-gray-200 text-gray-400 line-through' : 'bg-white border-gray-200 text-gray-700'
                          }`}>
                          <span className="font-medium">{formatTime(cls.start_time)}</span>
                          <span>{cls.course_code}</span>
                          <span className="text-gray-400">{cls.batch_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}
