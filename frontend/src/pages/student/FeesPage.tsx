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
  type FeeBalance, type LedgerEntry, type FeeTransaction, type TxnStatus,
} from '@/api/fee.api'
import { formatDate } from '@/utils/format'
import { Wallet, Receipt, X, IndianRupee, Download } from 'lucide-react'

const STATUS_VARIANT: Record<TxnStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  SUCCESS: 'success',
  PENDING: 'warning',
  CREATED: 'neutral',
  FAILED:  'danger',
}

// ── Razorpay checkout loader ───────────────────────────────────
declare global {
  interface Window { Razorpay?: any }
}

// ── Balance summary cards ──────────────────────────────────────
function BalanceCards({ balance }: { balance: FeeBalance }) {
  const cards = [
    { label: 'Net Payable',  value: balance.net_payable_paise, tone: 'text-gray-900' },
    { label: 'Paid',         value: balance.paid_paise,        tone: 'text-green-700' },
    { label: 'Late Fine',    value: balance.fine_paise,        tone: balance.fine_paise > 0 ? 'text-red-600' : 'text-gray-900' },
    { label: 'Balance Due',  value: balance.balance_due_paise, tone: balance.balance_due_paise > 0 ? 'text-red-600' : 'text-green-700' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</p>
          <p className={`text-xl font-bold mt-1 ${c.tone}`}>{formatPaise(c.value)}</p>
        </div>
      ))}
    </div>
  )
}

// ── Pay modal ──────────────────────────────────────────────────
function PayModal({ balanceDuePaise, onClose }: { balanceDuePaise: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [rupees, setRupees] = useState((balanceDuePaise / 100).toString())
  const [error, setError]   = useState<string | undefined>()

  const mutation = useMutation({
    mutationFn: async () => {
      const paise = Math.round(parseFloat(rupees) * 100)
      const order = await feeApi.createOrder(paise)
      return order
    },
    onSuccess: (order) => {
      // Open Razorpay checkout if the SDK is loaded and a key is available.
      const key = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
      if (window.Razorpay && key) {
        const rzp = new window.Razorpay({
          key,
          order_id: order.order_id,
          amount:   order.amount_paise,
          currency: order.currency,
          name:     'UniCampus ERP',
          description: 'Fee Payment',
          handler: () => {
            // Confirmation is authoritative via server webhook; just refresh + inform.
            toast.success('Payment received. Your receipt will appear once confirmed.')
            queryClient.invalidateQueries({ queryKey: ['fee'] })
            onClose()
          },
        })
        rzp.open()
      } else {
        toast('Payment order created. Online gateway is not configured in this environment.', { icon: 'ℹ️' })
        queryClient.invalidateQueries({ queryKey: ['fee'] })
        onClose()
      }
    },
    onError: () => toast.error('Could not start the payment. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(rupees)
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid amount greater than zero')
      return
    }
    if (Math.round(amount * 100) > balanceDuePaise) {
      setError('Amount cannot exceed your balance due')
      return
    }
    setError(undefined)
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Pay Fees Online</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Amount (₹)" required error={error}
            helpText={`Balance due: ${formatPaise(balanceDuePaise)}`}>
            <Input type="number" min="1" step="0.01" value={rupees}
              onChange={e => setRupees(e.target.value)} placeholder="Enter amount in rupees" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>
              <IndianRupee size={16} /> Proceed to Pay
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export function FeesPage() {
  const [showPay, setShowPay] = useState(false)

  const { data: ledger, isLoading, error } = useQuery({
    queryKey: ['fee', 'ledger'],
    queryFn:  feeApi.getMyLedger,
  })
  const { data: transactions } = useQuery({
    queryKey: ['fee', 'transactions'],
    queryFn:  feeApi.getMyTransactions,
  })

  return (
    <PageShell title="Fees">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Fees</h2>
          <p className="text-sm text-gray-500">Your fee balance, ledger, and payment history</p>
        </div>
        {ledger && ledger.balance.balance_due_paise > 0 && (
          <Button onClick={() => setShowPay(true)}>
            <Wallet size={16} /> Pay Now
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-danger font-medium">Could not load your fee details</p>
        </div>
      ) : ledger ? (
        <>
          <BalanceCards balance={ledger.balance} />

          {ledger.balance.concession_paise > 0 && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-green-900">Concessions applied to your account</p>
              <p className="font-semibold text-green-800">− {formatPaise(ledger.balance.concession_paise)}</p>
            </div>
          )}

          {/* Ledger */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Fee Ledger</h3>
            </div>
            {ledger.entries.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No ledger entries yet</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {ledger.entries.map((e: LedgerEntry) => (
                  <li key={e.ledger_id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{e.description}</p>
                      <p className="text-xs text-gray-400">{formatDate(e.posted_at)}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${
                      e.entry_type === 'CREDIT' ? 'text-green-700' : 'text-gray-900'
                    }`}>
                      {e.entry_type === 'CREDIT' ? '−' : '+'} {formatPaise(e.amount_paise)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Receipt size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Payment History</h3>
            </div>
            {!transactions || transactions.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No payments recorded yet</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {transactions.map((t: FeeTransaction) => (
                  <li key={t.transaction_id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{formatPaise(t.amount_paise)}</span>
                        <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                        <span className="text-xs text-gray-400 uppercase">{t.method}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.receipt_number ? `${t.receipt_number} · ` : ''}
                        {formatDate(t.paid_at ?? t.created_at)}
                      </p>
                    </div>
                    {t.status === 'SUCCESS' && t.receipt_number && (
                      <span className="text-xs text-accent flex items-center gap-1">
                        <Download size={13} /> Receipt
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}

      {showPay && ledger && (
        <PayModal balanceDuePaise={ledger.balance.balance_due_paise} onClose={() => setShowPay(false)} />
      )}
    </PageShell>
  )
}
