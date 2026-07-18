import { api } from './client'

export type GrievanceCategory = 'academic' | 'financial' | 'administrative' | 'hostel' | 'library' | 'other'
export type GrievanceStatus   = 'open' | 'in_review' | 'resolved' | 'escalated'

export interface Grievance {
  grievance_id:     number
  ticket_number:    string
  category:         GrievanceCategory
  subject:          string
  description:      string
  status:           GrievanceStatus
  assigned_role:    string
  sla_due_at:       string
  resolution_notes: string | null
  resolved_at:      string | null
  created_at:       string
  sla_breached:     boolean
  // Present only in officer queue / detail views
  roll_number?:     string
  student_name?:    string
}

export interface GrievanceTimelineEntry {
  old_status:      GrievanceStatus | null
  new_status:      GrievanceStatus
  comment:         string | null
  created_at:      string
  updated_by_name: string
}

export interface GrievanceDetail extends Grievance {
  timeline: GrievanceTimelineEntry[]
}

export interface GrievanceListMeta {
  page:        number
  per_page:    number
  total:       number
  total_pages: number
}

export const grievanceApi = {
  /** POST /api/v1/grievances — student submits a ticket */
  submit: async (payload: { category: GrievanceCategory; subject: string; description: string }) => {
    const { data } = await api.post('/grievances', payload)
    return data.data as { grievance_id: number; ticket_number: string; status: GrievanceStatus }
  },

  /** GET /api/v1/grievances/my */
  listMy: async (page = 1, status?: GrievanceStatus): Promise<{ grievances: Grievance[]; meta: GrievanceListMeta }> => {
    const { data } = await api.get('/grievances/my', { params: { page, status } })
    return { grievances: data.grievances, meta: data.meta }
  },

  /** GET /api/v1/grievances/assigned — officer queue */
  listAssigned: async (page = 1, status?: GrievanceStatus, category?: GrievanceCategory):
    Promise<{ grievances: Grievance[]; meta: GrievanceListMeta }> => {
    const { data } = await api.get('/grievances/assigned', { params: { page, status, category } })
    return { grievances: data.grievances, meta: data.meta }
  },

  /** GET /api/v1/grievances/:id — detail + timeline */
  getOne: async (id: number): Promise<GrievanceDetail> => {
    const { data } = await api.get(`/grievances/${id}`)
    return data.data
  },

  /** PATCH /api/v1/grievances/:id/status */
  updateStatus: async (id: number, payload: {
    status: 'in_review' | 'resolved' | 'escalated'
    comment?: string
    resolution_notes?: string
  }) => {
    const { data } = await api.patch(`/grievances/${id}/status`, payload)
    return data.data
  },
}
