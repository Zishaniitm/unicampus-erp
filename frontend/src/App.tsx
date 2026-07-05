import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoginPage }          from '@/pages/auth/LoginPage'
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage'
import { StudentDashboardPage } from '@/pages/student/DashboardPage'
import { TimetablePage }       from '@/pages/student/TimetablePage'
import type { Role } from '@/types/auth.types'

// ── Protected Route ────────────────────────────────────────────
interface ProtectedRouteProps {
  children: React.ReactNode
  roles?:   Role[]
}

function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isInitialized } = useAuth()

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-2 w-48">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Force password change before any other page
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />
  }

  // Role check — if roles array specified, user must have one of them
  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
          <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
          <a href="/dashboard" className="mt-4 inline-block text-accent hover:underline">Go to Dashboard</a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// ── Dashboard Router — redirects by role ───────────────────────
function DashboardRouter() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  // Route to role-specific dashboard
  switch (user.role) {
    case 'STUDENT':        return <StudentDashboardPage />
    case 'SUPER_ADMIN':    return <StudentDashboardPage /> // Placeholder — admin dashboard coming in Phase 3
    case 'HOD':            return <StudentDashboardPage /> // Placeholder — HOD dashboard coming Week 5
    case 'TEACHER':        return <StudentDashboardPage /> // Placeholder — teacher dashboard coming Week 5
    case 'ACCOUNT_OFFICER': return <StudentDashboardPage />
    default:               return <StudentDashboardPage />
  }
}

// ── App with session initialization ───────────────────────────
export default function App() {
  const { initialize, isInitialized } = useAuth()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={
        <ProtectedRoute>
          <ChangePasswordPage />
        </ProtectedRoute>
      } />

      {/* Authenticated routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardRouter />
        </ProtectedRoute>
      } />

      <Route path="/timetable" element={
        <ProtectedRoute roles={['STUDENT', 'TEACHER', 'HOD', 'SUPER_ADMIN']}>
          <TimetablePage />
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
