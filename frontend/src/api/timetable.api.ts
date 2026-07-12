import { api } from './client'

export interface TimetableEntry {
  entry_id:        number
  day_of_week:     string
  time_slot_id:    number
  slot_name:       string
  start_time:      string
  end_time:        string
  course_name:     string
  course_code:     string
  teacher_name:    string
  classroom_name:  string
  building:        string
  is_cancelled:    boolean
  cancel_reason?:  string
}

export interface WeeklyTimetable {
  batch_name:    string
  academic_year: string
  semester:      number
  entries:       TimetableEntry[]
}

export const timetableApi = {
  /** GET /api/v1/timetable/my — student's own timetable */
  getMyTimetable: async (): Promise<WeeklyTimetable> => {
    const { data } = await api.get('/timetable/my')
    return data.data
  },

  /** GET /api/v1/timetable/teacher/my — teacher's own schedule */
  getTeacherTimetable: async (): Promise<WeeklyTimetable> => {
    const { data } = await api.get('/timetable/teacher/my')
    return data.data
  },

  /** GET /api/v1/timetable/today — today's classes for current user */
  getTodayClasses: async (): Promise<TimetableEntry[]> => {
    const { data } = await api.get('/timetable/today')
    return data.data
  },
}
