import { api } from './client'

// All amounts from the API are in PAISE (integers). Divide by 100 for display.
export type FeeMethod   = 'razorpay' | 'cash' | 'cheque' | 'dd' | 'neft' | 'upi_offline'
export type TxnStatus   = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED'
export type ConcessionType = 'scholarship' | 'sibling' | 'staff_ward' | 'merit' | 'sports' | 'other'

export interface FeeBalance {
  gross_payable_paise: number
  concession_paise:    number
  net_payable_paise:   number
  paid_paise:          number
  fine_paise:          number
  balance_due_paise:   number
}

export interface LedgerEntry {
  ledger_id:    number
  entry_type:   'DEBIT' | 'CREDIT'
  amount_paise: number
  description:  string
  posted_at:    string
}

export interface FeeTransaction {
  transaction_id: number
  receipt_number: string | null
  amount_paise:   number
  method:         FeeMethod
  status:         TxnStatus
  paid_at:        string | null
  created_at:     string
}

export interface FeeHead {
  fee_head_id:   number
  head_code:     string
  head_name:     string
  description:   string | null
  is_refundable: boolean
  is_active:     boolean
  created_at:    string
}

export interface StudentLedgerView {
  student: { student_id: number; roll_number: string; name: string }
  balance: FeeBalance
  entries: LedgerEntry[]
}

/** Formats a paise integer as Indian Rupees, e.g. 5000000 → ₹50,000 */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(paise / 100)
}

export const feeApi = {
  // ── Student ──────────────────────────────────────────────
  /** GET /api/v1/fee/my/balance */
  getMyBalance: async (): Promise<FeeBalance> => {
    const { data } = await api.get('/fee/my/balance')
    return data.data
  },

  /** GET /api/v1/fee/my/ledger */
  getMyLedger: async (): Promise<{ balance: FeeBalance; entries: LedgerEntry[] }> => {
    const { data } = await api.get('/fee/my/ledger')
    return data.data
  },

  /** GET /api/v1/fee/my/transactions */
  getMyTransactions: async (): Promise<FeeTransaction[]> => {
    const { data } = await api.get('/fee/my/transactions')
    return data.data
  },

  /** POST /api/v1/fee/pay/order — returns a Razorpay order to open checkout */
  createOrder: async (amountPaise: number): Promise<{ order_id: string; amount_paise: number; currency: string }> => {
    const { data } = await api.post('/fee/pay/order', { amount_paise: amountPaise })
    return data.data
  },

  // ── Officer ──────────────────────────────────────────────
  /** GET /api/v1/fee/heads */
  listFeeHeads: async (): Promise<FeeHead[]> => {
    const { data } = await api.get('/fee/heads')
    return data.data
  },

  /** POST /api/v1/fee/heads */
  createFeeHead: async (payload: {
    head_code: string; head_name: string; description?: string; is_refundable?: boolean
  }): Promise<FeeHead> => {
    const { data } = await api.post('/fee/heads', payload)
    return data.data
  },

  /** POST /api/v1/fee/assignments */
  createAssignment: async (payload: {
    fee_head_id: number; batch_id: number; academic_year: string; semester: number
    amount_paise: number; due_date: string; late_fine_per_day_paise?: number
  }): Promise<{ assignment_id: number }> => {
    const { data } = await api.post('/fee/assignments', payload)
    return data.data
  },

  /** POST /api/v1/fee/concessions */
  grantConcession: async (payload: {
    student_id: number; assignment_id: number; concession_type: ConcessionType
    amount_paise: number; reason: string
  }): Promise<{ concession_id: number }> => {
    const { data } = await api.post('/fee/concessions', payload)
    return data.data
  },

  /** POST /api/v1/fee/offline-payment */
  recordOfflinePayment: async (payload: {
    student_id: number; amount_paise: number; method: Exclude<FeeMethod, 'razorpay'>
    offline_reference?: string; notes?: string
  }): Promise<{ transaction_id: number; receipt_number: string }> => {
    const { data } = await api.post('/fee/offline-payment', payload)
    return data.data
  },

  /** GET /api/v1/fee/students/:studentId/ledger */
  getStudentLedger: async (studentId: number): Promise<StudentLedgerView> => {
    const { data } = await api.get(`/fee/students/${studentId}/ledger`)
    return data.data
  },
}
