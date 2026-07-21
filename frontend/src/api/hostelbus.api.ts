import { api } from './client'

export type RegStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface RegistrationWindowInfo {
  window_id:     number
  window_type:   string
  academic_year: string
  opens_at:      string
  closes_at:     string
  is_active:     boolean
}

// ── Hostel ───────────────────────────────────────────────────
export interface HostelCategory {
  category_id:      number
  category_name:    string
  description:      string | null
  gender:           'Male' | 'Female' | 'Any'
  total_capacity:   number
  fee_per_semester_paise: number
  occupied:         number
  available:        number
}

export interface HostelRegistration {
  registration_id: number
  status:          RegStatus
  remarks:         string | null
  academic_year:   string
  created_at:      string
  decided_at:      string | null
  category_name:   string
  fee_per_semester_paise: number
}

export interface PendingHostelEntry {
  registration_id: number
  category_name:   string
  student_id:      number
  roll_number:     string
  student_name:    string
  remarks:         string | null
  created_at:      string
}

export const hostelApi = {
  listCategories: async (): Promise<HostelCategory[]> => {
    const { data } = await api.get('/hostel/categories')
    return data.data
  },
  createCategory: async (payload: {
    category_name: string; total_capacity: number; fee_per_semester_paise: number
    gender?: 'Male' | 'Female' | 'Any'; description?: string
  }) => {
    const { data } = await api.post('/hostel/categories', payload)
    return data.data
  },
  getMy: async (): Promise<{ window: RegistrationWindowInfo | null; registrations: HostelRegistration[] }> => {
    const { data } = await api.get('/hostel/my')
    return data.data
  },
  apply: async (payload: { category_id: number; remarks?: string }) => {
    const { data } = await api.post('/hostel/apply', payload)
    return data.data
  },
  listPending: async (): Promise<PendingHostelEntry[]> => {
    const { data } = await api.get('/hostel/pending')
    return data.data
  },
  decide: async (payload: { registration_id: number; decision: 'approved' | 'rejected'; remarks?: string }) => {
    const { data } = await api.post('/hostel/decide', payload)
    return data.data
  },
  setWindow: async (payload: {
    window_type: 'hostel' | 'bus' | 'semester'; academic_year: string
    opens_at: string; closes_at: string
  }) => {
    const { data } = await api.post('/hostel/windows', payload)
    return data.data
  },
}

// ── Bus ──────────────────────────────────────────────────────
export interface BusRoute {
  route_id:   number
  route_name: string
  stops:      string[]
  capacity:   number
  fee_per_semester_paise: number
  occupied:   number
  available:  number
}

export interface BusRegistration {
  registration_id: number
  status:          RegStatus
  stop_name:       string
  remarks:         string | null
  created_at:      string
  decided_at:      string | null
  route_name:      string
  fee_per_semester_paise: number
}

export interface PendingBusEntry {
  registration_id: number
  route_name:      string
  stop_name:       string
  student_id:      number
  roll_number:     string
  student_name:    string
  created_at:      string
}

export const busApi = {
  listRoutes: async (): Promise<BusRoute[]> => {
    const { data } = await api.get('/bus/routes')
    return data.data
  },
  createRoute: async (payload: {
    route_name: string; stops: string[]; capacity: number; fee_per_semester_paise: number
  }) => {
    const { data } = await api.post('/bus/routes', payload)
    return data.data
  },
  getMy: async (): Promise<{ window: RegistrationWindowInfo | null; registrations: BusRegistration[] }> => {
    const { data } = await api.get('/bus/my')
    return data.data
  },
  apply: async (payload: { route_id: number; stop_name: string }) => {
    const { data } = await api.post('/bus/apply', payload)
    return data.data
  },
  listPending: async (): Promise<PendingBusEntry[]> => {
    const { data } = await api.get('/bus/pending')
    return data.data
  },
  decide: async (payload: { registration_id: number; decision: 'approved' | 'rejected'; remarks?: string }) => {
    const { data } = await api.post('/bus/decide', payload)
    return data.data
  },
}
