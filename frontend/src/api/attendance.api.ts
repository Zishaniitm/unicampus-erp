import { api } from './client'

export interface AttendanceSummary {
  course_code:   string
  course_name:   string
  total:         number
  present:       number
  absent:        number
  medical_leave: number
  duty_leave:    number
  percentage:    number
}

export interface RosterStudent {
  student_id:  number
  roll_number: string
  name:        string
  status:      'P' | 'A' | 'ML' | 'DL' | null
  att_id:      number | null
}

export interface ClassRoster {
  entry: {
    entry_id:    number
    course_name: string
    course_code: string
    start_time:  string
    end_time:    string
    slot_name:   string
    day_of_week: string
  }
  date:           string
  students:       RosterStudent[]
  already_marked: boolean
}

export const attendanceApi = {
  /** GET /api/v1/attendance/my/summary */
  getMySummary: async (): Promise<AttendanceSummary[]> => {
    const { data } = await api.get('/attendance/my/summary')
    return data.data
  },

  /** GET /api/v1/attendance/roster/:entryId?date=YYYY-MM-DD */
  getRoster: async (entryId: number, date: string): Promise<ClassRoster> => {
    const { data } = await api.get(`/attendance/roster/${entryId}`, { params: { date } })
    return data.data
  },

  /** POST /api/v1/attendance/mark */
  markAttendance: async (payload: {
    timetable_entry_id: number
    att_date: string
    records: Array<{ student_id: number; status: 'P' | 'A' | 'ML' | 'DL' }>
  }) => {
    const { data } = await api.post('/attendance/mark', payload)
    return data.data
  },

  /** PATCH /api/v1/attendance/edit */
  editAttendance: async (payload: {
    att_id: number; status: 'P' | 'A' | 'ML' | 'DL'; edit_reason: string
  }) => {
    const { data } = await api.patch('/attendance/edit', payload)
    return data.data
  },

  /** GET /api/v1/attendance/batch/:batchId */
  getBatchSummary: async (batchId: number, fromDate?: string, toDate?: string) => {
    const { data } = await api.get(`/attendance/batch/${batchId}`, {
      params: { from_date: fromDate, to_date: toDate },
    })
    return data.data
  },
}
