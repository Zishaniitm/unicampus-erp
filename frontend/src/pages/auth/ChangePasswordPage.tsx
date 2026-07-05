import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/stores/auth.store'
import { Button }    from '@/components/ui/Button'
import { Input }     from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import toast from 'react-hot-toast'
import { Lock, ShieldCheck } from 'lucide-react'

/** Shown when must_change_password === true — blocks access to all other pages */
export function ChangePasswordPage() {
  const navigate  = useNavigate()
  const setUser   = useAuthStore(s => s.setUser)
  const user      = useAuthStore(s => s.user)

  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!current)                            e.current = 'Required'
    if (next.length < 8)                     e.next    = 'Minimum 8 characters'
    else if (!/[A-Z]/.test(next))            e.next    = 'Must include an uppercase letter'
    else if (!/[0-9]/.test(next))            e.next    = 'Must include a number'
    else if (!/[^A-Za-z0-9]/.test(next))    e.next    = 'Must include a special character'
    if (next !== confirm)                    e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await authApi.changePassword({ current_password: current, new_password: next })
      toast.success('Password changed successfully. Welcome!')
      // Update local store to clear must_change_password flag
      if (user) setUser({ ...user, must_change_password: false })
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const message = err?.response?.data?.error?.message
      if (message?.toLowerCase().includes('incorrect')) {
        setErrors(p => ({ ...p, current: 'Current password is incorrect' }))
      } else {
        toast.error(message ?? 'Failed to change password. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 rounded-2xl mb-3">
            <ShieldCheck size={28} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set Your Password</h1>
          <p className="text-gray-500 text-sm mt-1">
            This is your first login. Please set a new secure password to continue.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Current (Temporary) Password" error={errors.current} required>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type="password" value={current} onChange={e => setCurrent(e.target.value)}
                  error={errors.current} className="pl-9" placeholder="Temporary password from SMS" />
              </div>
            </FormField>

            <FormField label="New Password" error={errors.next} required
              helpText="Min 8 chars, 1 uppercase, 1 number, 1 special character">
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type="password" value={next} onChange={e => setNext(e.target.value)}
                  error={errors.next} className="pl-9" placeholder="Choose a strong password" />
              </div>
            </FormField>

            <FormField label="Confirm New Password" error={errors.confirm} required>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  error={errors.confirm} className="pl-9" placeholder="Repeat your new password" />
              </div>
            </FormField>

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Set Password & Continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
