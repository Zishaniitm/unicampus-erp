import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button }    from '@/components/ui/Button'
import { Input }     from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import toast from 'react-hot-toast'
import { GraduationCap, Eye, EyeOff, Lock, User } from 'lucide-react'

export function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [username,       setUsername]       = useState('')
  const [password,       setPassword]       = useState('')
  const [showPassword,   setShowPassword]   = useState(false)
  const [errors,         setErrors]         = useState<{ username?: string; password?: string }>({})

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  function validate(): boolean {
    const e: typeof errors = {}
    if (!username.trim())      e.username = 'Username is required'
    if (!password)             e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    try {
      await login({ username: username.trim(), password })
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      const code    = err?.response?.data?.error?.code
      const message = err?.response?.data?.error?.message

      if (code === 'ERR-AUTH-002') {
        toast.error(message ?? 'Account locked. Please try again later.')
      } else if (code === 'ERR-AUTH-001') {
        setErrors({ password: 'Invalid credentials. Please try again.' })
      } else {
        toast.error(message ?? 'Login failed. Please try again.')
      }
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <GraduationCap size={22} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl">UniCampus ERP</span>
        </div>

        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            United Institute<br />of Management
            <span className="text-blue-300"> (FUGS)</span>
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed">
            Your complete college management platform — timetables, attendance, fees, library, and more in one place.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              ['11,200+', 'Students'],
              ['750+',    'Faculty Members'],
              ['8',       'Institutes'],
              ['14,000+', 'Alumni'],
            ].map(([num, label]) => (
              <div key={label} className="bg-white/10 rounded-xl p-4">
                <p className="text-white text-2xl font-bold">{num}</p>
                <p className="text-blue-200 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-blue-300/60 text-sm">
          © 2026 United Group of Institutions. Powered by UniCampus ERP.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <GraduationCap size={22} className="text-white" />
            </div>
            <span className="text-primary font-bold text-xl">UniCampus ERP</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-6">Sign in with your college credentials</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Username or Email" error={errors.username} required>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setErrors(p => ({ ...p, username: undefined })) }}
                    error={errors.username}
                    className="pl-9"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </FormField>

              <FormField label="Password" error={errors.password} required>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                    error={errors.password}
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <div className="flex justify-end">
                <a href="/forgot-password" className="text-xs text-accent hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button type="submit" loading={isLoading} className="w-full" size="lg">
                {isLoading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Having trouble? Contact IT Support at{' '}
              <a href="mailto:support@united.ac.in" className="text-accent hover:underline">
                support@united.ac.in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
