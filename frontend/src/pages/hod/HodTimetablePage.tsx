import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { api } from '@/api/client'
import { formatTime } from '@/utils/format'
import toast from 'react-hot-toast'
import { Plus, X, AlertTriangle, Calendar } from 'lucide-react'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

interface TimetableEntry {
  entry_id: number; day_of_week: string; start_time: string; end_time: string
  slot_name: string; course_name: string; course_code: string
  teacher_name: string; classroom_name: string; building: string
  batch_name: string; is_cancelled: boolean; cancel_reason?: string
}

interface Resource {
  teachers: Array<{ teacher_id: number; name: string; designation: string }>
  classrooms: Array<{ classroom_id: number; classroom_name: string; building: string; capacity: number; is_lab: boolean }>
  time_slots: Array<{ time_slot_id: number; slot_name: string; start_time: string; end_time: string }>
  batch_courses: Array<{ batch_course_id: number; course_name: string; course_code: string; batch_name: string; teacher_name: string }>
}

// ── Add Entry Modal ────────────────────────────────────────────
function AddEntryModal({ timetableId, deptId, onClose }: {
  timetableId: number; deptId: number; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    day_of_week: 'Monday', time_slot_id: '', batch_course_id: '', classroom_id: '', teacher_id: ''
  })
  const [errors, setErrors] = useState<Record<string,string>>({})

  const { data: resources, isLoading: loadingRes } = useQuery({
    queryKey: ['timetable', 'resources', deptId],
    queryFn: async () => {
      const res = await api.get(`/timetable/resources?dept_id=${deptId}`)
      return res.data.data as Resource
    },
  })

  const { mutate: addEntry, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        timetable_id:   timetableId,
        day_of_week:    form.day_of_week,
        time_slot_id:   parseInt(form.time_slot_id),
        batch_course_id: parseInt(form.batch_course_id),
        classroom_id:   parseInt(form.classroom_id),
        teacher_id:     parseInt(form.teacher_id),
      }
      const res = await api.post('/timetable/entries', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success('Class added to timetable!')
      queryClient.invalidateQueries({ queryKey: ['timetable', 'hod'] })
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? 'Failed to add class'
      const code = err?.response?.data?.error?.code ?? ''
      if (code === 'ERR-TT-001') setErrors({ teacher_id: msg })
      else if (code === 'ERR-TT-002') setErrors({ classroom_id: msg })
      else if (code === 'ERR-TT-003') setErrors({ day_of_week: msg })
      else toast.error(msg)
    },
  })

  function validate() {
    const e: Record<string,string> = {}
    if (!form.time_slot_id)   e.time_slot_id   = 'Required'
    if (!form.batch_course_id) e.batch_course_id = 'Required'
    if (!form.classroom_id)   e.classroom_id   = 'Required'
    if (!form.teacher_id)     e.teacher_id     = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) addEntry()
  }

  function field(key: keyof typeof form, value: string) {
    setForm(p => ({ ...p, [key]: value }))
    setErrors(p => ({ ...p, [key]: '' }))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-gray-900">Add Class to Timetable</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        {loadingRes ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Day" error={errors.day_of_week}>
                <select value={form.day_of_week} onChange={e => field('day_of_week', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30">
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </FormField>

              <FormField label="Time Slot" error={errors.time_slot_id} required>
                <select value={form.time_slot_id} onChange={e => field('time_slot_id', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="">Select slot</option>
                  {resources?.time_slots.map(ts => (
                    <option key={ts.time_slot_id} value={ts.time_slot_id}>
                      {ts.slot_name} ({formatTime(ts.start_time)}–{formatTime(ts.end_time)})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Course / Batch" error={errors.batch_course_id} required>
              <select value={form.batch_course_id} onChange={e => field('batch_course_id', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">Select course</option>
                {resources?.batch_courses.map(bc => (
                  <option key={bc.batch_course_id} value={bc.batch_course_id}>
                    {bc.course_code} — {bc.course_name} ({bc.batch_name})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Teacher" error={errors.teacher_id} required>
              <select value={form.teacher_id} onChange={e => field('teacher_id', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">Select teacher</option>
                {resources?.teachers.map(t => (
                  <option key={t.teacher_id} value={t.teacher_id}>{t.name} — {t.designation}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Classroom" error={errors.classroom_id} required>
              <select value={form.classroom_id} onChange={e => field('classroom_id', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">Select classroom</option>
                {resources?.classrooms.map(c => (
                  <option key={c.classroom_id} value={c.classroom_id}>
                    {c.classroom_name}, {c.building} (Cap: {c.capacity}{c.is_lab ? ', Lab' : ''})
                  </option>
                ))}
              </select>
            </FormField>

            {Object.values(errors).some(Boolean) && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{Object.values(errors).filter(Boolean)[0]}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={isPending} className="flex-1">Add Class</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main HOD Timetable Page ────────────────────────────────────
export function HodTimetablePage() {
  const [selectedTimetableId, setSelectedTimetableId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const queryClient = useQueryClient()

  // For now use dept_id=1 — in production HOD's dept_id comes from their profile
  const DEPT_ID = 1

  const { data: timetables, isLoading: loadingTT } = useQuery({
    queryKey: ['timetable', 'hod', 'list'],
    queryFn: async () => {
      const res = await api.get(`/timetable/dept?dept_id=${DEPT_ID}`)
      return res.data.data as Array<{
        timetable_id: number; batch_name: string; section: string
        academic_year: string; semester: number; is_active: boolean; entry_count: string
      }>
    },
  })

  const activeTimetable = timetables?.find(t => t.timetable_id === selectedTimetableId)
    ?? timetables?.find(t => t.is_active)

  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['timetable', 'hod', activeTimetable?.timetable_id],
    queryFn: async () => {
      if (!activeTimetable) return []
      const res = await api.get(`/timetable/my`)
      return res.data.data?.entries as TimetableEntry[] ?? []
    },
    enabled: !!activeTimetable,
  })

  const { mutate: cancelEntry, isPending: cancelling } = useMutation({
    mutationFn: async (entryId: number) => {
      await api.patch(`/timetable/entries/${entryId}/cancel`, { reason: cancelReason })
    },
    onSuccess: () => {
      toast.success('Class cancelled.')
      setCancellingId(null)
      setCancelReason('')
      queryClient.invalidateQueries({ queryKey: ['timetable', 'hod'] })
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message ?? 'Failed to cancel'),
  })

  return (
    <PageShell title="Timetable Management">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Timetable Management</h2>
          <p className="text-sm text-gray-500">Create and manage class schedules for your department</p>
        </div>
        {activeTimetable && (
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={15} /> Add Class
          </Button>
        )}
      </div>

      {/* Timetable selector */}
      {loadingTT ? (
        <div className="flex gap-3 mb-6">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-16 w-40 rounded-xl" />)}</div>
      ) : !timetables?.length ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center mb-6">
          <Calendar size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No timetables found</p>
          <p className="text-sm text-gray-400 mt-1">Contact admin to create a timetable for your batches</p>
        </div>
      ) : (
        <div className="flex gap-3 mb-6 flex-wrap">
          {timetables.map(tt => (
            <button key={tt.timetable_id}
              onClick={() => setSelectedTimetableId(tt.timetable_id)}
              className={`px-4 py-3 rounded-xl border text-left transition-all ${
                activeTimetable?.timetable_id === tt.timetable_id
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <p className="text-sm font-semibold text-gray-800">{tt.batch_name}</p>
              <p className="text-xs text-gray-500">Sem {tt.semester} · {tt.academic_year}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {tt.is_active && <Badge variant="success">Active</Badge>}
                <Badge variant="neutral">{tt.entry_count} classes</Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Weekly grid */}
      {activeTimetable && (
        <div className="space-y-3">
          {DAYS.map(day => {
            const dayEntries = (entries ?? [])
              .filter(e => e.day_of_week === day)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))

            return (
              <div key={day} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">{day}</h3>
                  <span className="text-xs text-gray-400">{dayEntries.length} class{dayEntries.length !== 1 ? 'es' : ''}</span>
                </div>

                {loadingEntries ? (
                  <div className="p-4"><Skeleton className="h-10 w-full rounded-lg" /></div>
                ) : dayEntries.length === 0 ? (
                  <div className="px-5 py-3 text-sm text-gray-400">No classes</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {dayEntries.map(entry => (
                      <div key={entry.entry_id}
                        className={`flex items-center gap-4 px-5 py-3 ${entry.is_cancelled ? 'opacity-50' : ''}`}>
                        <div className="text-center min-w-[60px] shrink-0">
                          <p className="text-xs font-bold text-accent">{formatTime(entry.start_time)}</p>
                          <p className="text-xs text-gray-400">{formatTime(entry.end_time)}</p>
                        </div>
                        <div className="w-1 h-10 rounded-full bg-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{entry.course_name}</p>
                            <Badge variant="neutral">{entry.course_code}</Badge>
                            {entry.is_cancelled && <Badge variant="danger">Cancelled</Badge>}
                          </div>
                          <p className="text-xs text-gray-500">
                            {entry.teacher_name} · {entry.classroom_name}, {entry.building}
                          </p>
                        </div>

                        {/* Cancel button */}
                        {!entry.is_cancelled && (
                          cancellingId === entry.entry_id ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <Input
                                placeholder="Reason for cancellation"
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                className="text-xs w-48"
                              />
                              <Button size="sm" variant="danger"
                                loading={cancelling}
                                disabled={cancelReason.length < 5}
                                onClick={() => cancelEntry(entry.entry_id)}>
                                Confirm
                              </Button>
                              <Button size="sm" variant="ghost"
                                onClick={() => { setCancellingId(null); setCancelReason('') }}>
                                <X size={14} />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost"
                              onClick={() => setCancellingId(entry.entry_id)}
                              className="shrink-0 text-gray-400 hover:text-danger">
                              Cancel Class
                            </Button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddModal && activeTimetable && (
        <AddEntryModal
          timetableId={activeTimetable.timetable_id}
          deptId={DEPT_ID}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </PageShell>
  )
}
