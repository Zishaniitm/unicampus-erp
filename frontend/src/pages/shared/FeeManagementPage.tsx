import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { PageShell } from '@/components/layout/PageShell'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import {
  feeApi, formatPaise,
  type FeeHead, type StudentLedgerView, type ConcessionType,
} from '@/api/fee.api'
import { formatDate } from '@/utils/format'
import { Plus, X, Search, IndianRupee, Tag } from 'lucide-react'

const CONCESSION_LABELS: Record<ConcessionType, string> = {
  scholarship: 'Scholarship',
  sibling:     'Sibling',
  staff_ward:  'Staff Ward',
  merit:       'Merit',
  sports:      'Sports',
  other:       'Other',
}
const OFFLINE_METHODS = ['cash', 'cheque', 'dd', 'neft', 'upi_offline'] as const

// ── Create fee head modal ──────────────────────────────────────
function CreateHeadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [refundable, setRefundable] = useState(false)

  const mutation = useMutation({
    mutationFn: () => feeApi.createFeeHead({ head_code: code.trim().toUpperCase(), head_name: name.trim(), is_refundable: refundable }),
    onSuccess: () => {
      toast.success('Fee head created.')
      queryClient.invalidateQueries({ queryKey: ['fee', 'heads'] })
      onClose()
    },
    onError: () => toast.error('Could not create the fee head. Code may already exist.'),
  })

  return (
    <ModalShell title="New Fee Head" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="p-6 space-y-4">
        <FormField label="Head Code" required helpText="UPPERCASE letters, digits, underscore — e.g. TUITION">
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="TUITION" maxLength={30} />
        </FormField>
        <FormField label="Head Name" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Tuition Fee" maxLength={100} />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={refundable} onChange={e => setRefundable(e.target.checked)} />
          Refundable (deposit)
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><Plus size={16} /> Create</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Assign fee to batch modal ──────────────────────────────────
function AssignFeeModal({ heads, onClose }: { heads: FeeHead[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [feeHeadId, setFeeHeadId] = useState(heads[0]?.fee_head_id ?? 0)
  const [batchId, setBatchId]     = useState('')
  const [year, setYear]           = useState('')
  const [semester, setSemester]   = useState('1')
  const [rupees, setRupees]       = useState('')
  const [dueDate, setDueDate]     = useState('')
  const [fineRupees, setFineRupees] = useState('0')
  const [err, setErr]             = useState<string | undefined>()

  const mutation = useMutation({
    mutationFn: () => feeApi.createAssignment({
      fee_head_id: feeHeadId,
      batch_id:    parseInt(batchId, 10),
      academic_year: year.trim(),
      semester:    parseInt(semester, 10),
      amount_paise: Math.round(parseFloat(rupees) * 100),
      due_date:    dueDate,
      late_fine_per_day_paise: Math.round(parseFloat(fineRupees || '0') * 100),
    }),
    onSuccess: () => {
      toast.success('Fee assigned to batch. Student ledgers updated.')
      queryClient.invalidateQueries({ queryKey: ['fee'] })
      onClose()
    },
    onError: () => toast.error('Could not assign the fee. Check the batch and inputs.'),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchId || !year.match(/^\d{4}-\d{4}$/) || !rupees || !dueDate) {
      setErr('Fill batch, academic year (YYYY-YYYY), amount, and due date')
      return
    }
    setErr(undefined)
    mutation.mutate()
  }

  return (
    <ModalShell title="Assign Fee to Batch" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        {err && <p className="text-sm text-danger">{err}</p>}
        <FormField label="Fee Head" required>
          <select value={feeHeadId} onChange={e => setFeeHeadId(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
            {heads.map(h => <option key={h.fee_head_id} value={h.fee_head_id}>{h.head_name} ({h.head_code})</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Batch ID" required>
            <Input type="number" value={batchId} onChange={e => setBatchId(e.target.value)} placeholder="e.g. 3" />
          </FormField>
          <FormField label="Semester" required>
            <select value={semester} onChange={e => setSemester(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Academic Year" required helpText="Format YYYY-YYYY">
          <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2026-2027" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Amount (₹)" required>
            <Input type="number" min="0" step="0.01" value={rupees} onChange={e => setRupees(e.target.value)} placeholder="50000" />
          </FormField>
          <FormField label="Late fine / day (₹)">
            <Input type="number" min="0" step="0.01" value={fineRupees} onChange={e => setFineRupees(e.target.value)} placeholder="0" />
          </FormField>
        </div>
        <FormField label="Due Date" required>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Assign</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Record offline payment modal ───────────────────────────────
function OfflinePaymentModal({ studentId, onClose }: { studentId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [rupees, setRupees]     = useState('')
  const [method, setMethod]     = useState<(typeof OFFLINE_METHODS)[number]>('cash')
  const [reference, setReference] = useState('')

  const mutation = useMutation({
    mutationFn: () => feeApi.recordOfflinePayment({
      student_id: studentId,
      amount_paise: Math.round(parseFloat(rupees) * 100),
      method,
      offline_reference: reference.trim() || undefined,
    }),
    onSuccess: (d) => {
      toast.success(`Payment recorded. Receipt ${d.receipt_number}`)
      queryClient.invalidateQueries({ queryKey: ['fee'] })
      onClose()
    },
    onError: () => toast.error('Could not record the payment.'),
  })

  return (
    <ModalShell title="Record Offline Payment" onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (parseFloat(rupees) > 0) mutation.mutate() }} className="p-6 space-y-4">
        <FormField label="Amount (₹)" required>
          <Input type="number" min="1" step="0.01" value={rupees} onChange={e => setRupees(e.target.value)} placeholder="10000" />
        </FormField>
        <FormField label="Method" required>
          <select value={method} onChange={e => setMethod(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
            {OFFLINE_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
          </select>
        </FormField>
        <FormField label="Reference" helpText="Cheque / DD / transaction number (optional)">
          <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="CHQ-000123" maxLength={60} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><IndianRupee size={16} /> Record</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Grant concession modal ─────────────────────────────────────
function ConcessionModal({ studentId, onClose }: { studentId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [assignmentId, setAssignmentId] = useState('')
  const [type, setType]     = useState<ConcessionType>('scholarship')
  const [rupees, setRupees] = useState('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => feeApi.grantConcession({
      student_id: studentId,
      assignment_id: parseInt(assignmentId, 10),
      concession_type: type,
      amount_paise: Math.round(parseFloat(rupees) * 100),
      reason: reason.trim(),
    }),
    onSuccess: () => {
      toast.success('Concession granted.')
      queryClient.invalidateQueries({ queryKey: ['fee'] })
      onClose()
    },
    onError: () => toast.error('Could not grant the concession. Check the assignment ID and amount.'),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (assignmentId && parseFloat(rupees) > 0 && reason.trim().length >= 5) mutation.mutate()
    else toast.error('Assignment ID, amount, and a reason (5+ chars) are required.')
  }

  return (
    <ModalShell title="Grant Concession" onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <FormField label="Assignment ID" required helpText="The fee assignment this waiver applies to">
          <Input type="number" value={assignmentId} onChange={e => setAssignmentId(e.target.value)} placeholder="e.g. 12" />
        </FormField>
        <FormField label="Type" required>
          <select value={type} onChange={e => setType(e.target.value as ConcessionType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40">
            {(Object.keys(CONCESSION_LABELS) as ConcessionType[]).map(t => <option key={t} value={t}>{CONCESSION_LABELS[t]}</option>)}
          </select>
        </FormField>
        <FormField label="Amount (₹)" required>
          <Input type="number" min="1" step="0.01" value={rupees} onChange={e => setRupees(e.target.value)} placeholder="5000" />
        </FormField>
        <FormField label="Reason" required>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500}
            placeholder="e.g. Merit scholarship for AY 2026-27"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}><Tag size={16} /> Grant</Button>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Reusable modal shell ───────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function FeeManagementPage() {
  const [modal, setModal] = useState<'head' | 'assign' | 'offline' | 'concession' | null>(null)
  const [lookupId, setLookupId] = useState('')
  const [activeStudent, setActiveStudent] = useState<number | null>(null)

  const { data: heads, isLoading } = useQuery({ queryKey: ['fee', 'heads'], queryFn: feeApi.listFeeHeads })

  const { data: studentLedger, isFetching: ledgerLoading, refetch, error: ledgerError } = useQuery<StudentLedgerView>({
    queryKey: ['fee', 'student-ledger', activeStudent],
    queryFn:  () => feeApi.getStudentLedger(activeStudent!),
    enabled:  activeStudent !== null,
  })

  function lookup(e: React.FormEvent) {
    e.preventDefault()
    const id = parseInt(lookupId, 10)
    if (!isNaN(id)) { setActiveStudent(id); refetch() }
  }

  return (
    <PageShell title="Fee Management">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Fee Administration</h2>
          <p className="text-sm text-gray-500">Manage fee heads, batch assignments, concessions and payments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setModal('head')}><Plus size={15} /> Fee Head</Button>
          <Button variant="outline" size="sm" onClick={() => setModal('assign')} disabled={!heads?.length}>Assign to Batch</Button>
        </div>
      </div>

      {/* Fee heads */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
        <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Fee Heads</h3></div>
        {isLoading ? (
          <div className="p-4"><SkeletonCard /></div>
        ) : !heads?.length ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No fee heads yet — create one to get started</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {heads.map(h => (
              <li key={h.fee_head_id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{h.head_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{h.head_code}</p>
                </div>
                <div className="flex items-center gap-2">
                  {h.is_refundable && <Badge variant="info">Refundable</Badge>}
                  <Badge variant={h.is_active ? 'success' : 'neutral'}>{h.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Student lookup */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Student Ledger</h3></div>
        <div className="p-5">
          <form onSubmit={lookup} className="flex gap-2 mb-4">
            <Input type="number" value={lookupId} onChange={e => setLookupId(e.target.value)}
              placeholder="Enter student ID" className="max-w-xs" />
            <Button type="submit" variant="secondary"><Search size={16} /> Look up</Button>
          </form>

          {ledgerError ? (
            <p className="text-sm text-danger">Student not found.</p>
          ) : ledgerLoading ? (
            <SkeletonCard />
          ) : studentLedger ? (
            <div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{studentLedger.student.name}</p>
                  <p className="text-xs text-gray-400">{studentLedger.student.roll_number}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setModal('offline')}>Record Payment</Button>
                  <Button size="sm" variant="outline" onClick={() => setModal('concession')}>Grant Concession</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <Stat label="Net Payable" value={formatPaise(studentLedger.balance.net_payable_paise)} />
                <Stat label="Paid" value={formatPaise(studentLedger.balance.paid_paise)} tone="text-green-700" />
                <Stat label="Fine" value={formatPaise(studentLedger.balance.fine_paise)} tone={studentLedger.balance.fine_paise > 0 ? 'text-red-600' : undefined} />
                <Stat label="Due" value={formatPaise(studentLedger.balance.balance_due_paise)} tone={studentLedger.balance.balance_due_paise > 0 ? 'text-red-600' : 'text-green-700'} />
              </div>
              {studentLedger.entries.length > 0 && (
                <ul className="divide-y divide-gray-50 border-t border-gray-100">
                  {studentLedger.entries.map(e => (
                    <li key={e.ledger_id} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-800">{e.description}</p>
                        <p className="text-xs text-gray-400">{formatDate(e.posted_at)}</p>
                      </div>
                      <span className={`text-sm font-semibold ${e.entry_type === 'CREDIT' ? 'text-green-700' : 'text-gray-900'}`}>
                        {e.entry_type === 'CREDIT' ? '−' : '+'} {formatPaise(e.amount_paise)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Enter a student ID to view their ledger and record payments.</p>
          )}
        </div>
      </div>

      {modal === 'head' && <CreateHeadModal onClose={() => setModal(null)} />}
      {modal === 'assign' && heads && <AssignFeeModal heads={heads} onClose={() => setModal(null)} />}
      {modal === 'offline' && activeStudent !== null && <OfflinePaymentModal studentId={activeStudent} onClose={() => setModal(null)} />}
      {modal === 'concession' && activeStudent !== null && <ConcessionModal studentId={activeStudent} onClose={() => setModal(null)} />}
    </PageShell>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${tone ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
