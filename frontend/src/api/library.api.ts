import { api } from './client'

// All amounts in PAISE — use formatPaise from fee.api for display.
export type IssueStatus = 'issued' | 'returned' | 'lost'

export interface LibraryBook {
  book_id:          number
  isbn:             string | null
  title:            string
  author:           string
  publisher:        string | null
  category:         string | null
  edition:          string | null
  total_copies:     number
  available_copies: number
  rack_number:      string | null
}

export interface MyIssue {
  issue_id:    number
  status:      IssueStatus
  issue_date:  string
  due_date:    string
  return_date: string | null
  title:       string
  author:      string
  isbn:        string | null
  overdue:     boolean
  estimated_fine_paise: number
}

export interface IssuedListEntry {
  issue_id:     number
  title:        string
  author:       string
  student_id:   number
  roll_number:  string
  student_name: string
  issue_date:   string
  due_date:     string
  overdue:      boolean
  estimated_fine_paise: number
}

export interface LibraryFine {
  fine_id:      number
  issue_id:     number
  amount_paise: number
  reason:       string
  is_paid:      boolean
  paid_at:      string | null
  waived_by:    string | null
  created_at:   string
}

export interface StudentLibraryRecord {
  student: { student_id: number; roll_number: string; name: string }
  issues:  Array<Pick<MyIssue, 'issue_id' | 'status' | 'issue_date' | 'due_date' | 'return_date' | 'title' | 'author'>>
  fines:   LibraryFine[]
  unpaid_fines_paise: number
}

export interface BookListMeta {
  page: number; per_page: number; total: number; total_pages: number
}

export const libraryApi = {
  /** GET /api/v1/library/books */
  listBooks: async (page = 1, search?: string, category?: string):
    Promise<{ books: LibraryBook[]; meta: BookListMeta }> => {
    const { data } = await api.get('/library/books', { params: { page, search, category } })
    return { books: data.books, meta: data.meta }
  },

  /** POST /api/v1/library/books */
  createBook: async (payload: {
    title: string; author: string; total_copies: number
    isbn?: string; publisher?: string; category?: string; edition?: string; rack_number?: string
  }) => {
    const { data } = await api.post('/library/books', payload)
    return data.data
  },

  /** GET /api/v1/library/my/issued */
  getMyIssues: async (): Promise<{ issues: MyIssue[]; unpaid_fines_paise: number }> => {
    const { data } = await api.get('/library/my/issued')
    return data.data
  },

  /** POST /api/v1/library/issues */
  issueBook: async (payload: { book_id: number; student_id: number; due_date?: string }) => {
    const { data } = await api.post('/library/issues', payload)
    return data.data as { issue_id: number; issue_date: string; due_date: string }
  },

  /** POST /api/v1/library/returns */
  returnBook: async (payload: { issue_id: number; lost?: boolean }) => {
    const { data } = await api.post('/library/returns', payload)
    return data.data as { issue_id: number; fine_paise: number; status: IssueStatus }
  },

  /** GET /api/v1/library/issued */
  getIssuedList: async (overdueOnly = false): Promise<IssuedListEntry[]> => {
    const { data } = await api.get('/library/issued', { params: { overdue: overdueOnly } })
    return data.data
  },

  /** GET /api/v1/library/students/:id */
  getStudentRecord: async (studentId: number): Promise<StudentLibraryRecord> => {
    const { data } = await api.get(`/library/students/${studentId}`)
    return data.data
  },

  /** POST /api/v1/library/fines/pay */
  payFine: async (fineId: number) => {
    const { data } = await api.post('/library/fines/pay', { fine_id: fineId })
    return data.data
  },

  /** POST /api/v1/library/fines/waive */
  waiveFine: async (fineId: number, reason: string) => {
    const { data } = await api.post('/library/fines/waive', { fine_id: fineId, reason })
    return data.data
  },
}
