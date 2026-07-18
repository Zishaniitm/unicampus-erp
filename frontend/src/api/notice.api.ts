import { api } from './client'

export type NoticeTargetRole = string | null

export interface Notice {
  notice_id:    number
  title:        string
  body:         string
  is_critical:  boolean
  visible_from: string | null
  visible_to:   string | null
  posted_by:    string
  target_role:  NoticeTargetRole
  target_dept:  number | null
  target_batch: number | null
  created_at:   string
  is_read:      boolean
}

export interface MyPostedNotice {
  notice_id:    number
  title:        string
  body:         string
  is_critical:  boolean
  is_active:    boolean
  target_role:  NoticeTargetRole
  target_dept:  number | null
  target_batch: number | null
  visible_from: string | null
  visible_to:   string | null
  created_at:   string
  read_count:   number
}

export interface NoticeListMeta {
  page:        number
  per_page:    number
  total:       number
  unread?:     number
  total_pages: number
}

export interface CreateNoticePayload {
  title:         string
  body:          string
  is_critical?:  boolean
  target_role?:  string
  target_dept?:  number
  target_batch?: number
  visible_from?: string
  visible_to?:   string
}

export const noticeApi = {
  /** GET /api/v1/notices */
  list: async (page = 1, perPage = 10): Promise<{ notices: Notice[]; meta: NoticeListMeta }> => {
    const { data } = await api.get('/notices', { params: { page, per_page: perPage } })
    return { notices: data.notices, meta: data.meta }
  },

  /** POST /api/v1/notices */
  create: async (payload: CreateNoticePayload): Promise<{ notice_id: number }> => {
    const { data } = await api.post('/notices', payload)
    return data.data
  },

  /** POST /api/v1/notices/:id/read */
  markRead: async (noticeId: number) => {
    const { data } = await api.post(`/notices/${noticeId}/read`)
    return data.data
  },

  /** GET /api/v1/notices/my-posted */
  listMyPosted: async (page = 1, perPage = 10): Promise<{ notices: MyPostedNotice[]; meta: NoticeListMeta }> => {
    const { data } = await api.get('/notices/my-posted', { params: { page, per_page: perPage } })
    return { notices: data.notices, meta: data.meta }
  },

  /** DELETE /api/v1/notices/:id */
  deactivate: async (noticeId: number) => {
    const { data } = await api.delete(`/notices/${noticeId}`)
    return data.data
  },
}
