import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoginPage }            from '@/pages/auth/LoginPage'
import { ChangePasswordPage }   from '@/pages/auth/ChangePasswordPage'
import { StudentDashboardPage } from '@/pages/student/DashboardPage'
import { TimetablePage }        from '@/pages/student/TimetablePage'
import { AttendancePage }       from '@/pages/student/AttendancePage'
import { MarkAttendancePage }   from '@/pages/teacher/MarkAttendancePage'
import type { Role } from '@/types/auth.types'

// ── Protected Route ────────────────────────────────────────────
function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, isAuthenticated, isInitialized } = useAuth()

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-3 w-48">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Enforce first-login password change
  if (user?.must_change_password) return <Navigate to="/change-password" replace />

  // Role check
  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
          <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
          <a href="/dashboard" className="mt-4 inline-block text-accent hover:underline">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// ── Dashboard router — role-based ──────────────────────────────
function DashboardRouter() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  // All roles currently get student dashboard — role-specific dashboards in Phase 3
  return <StudentDashboardPage />
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const { initialize } = useAuth()

  useEffect(() => {
    initialize()
  }, [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"           element={<LoginPage />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />

      {/* Student pages */}
      <Route path="/timetable" element={
        <ProtectedRoute roles={['STUDENT', 'TEACHER', 'HOD', 'SUPER_ADMIN', 'PRINCIPAL']}>
          <TimetablePage />
        </ProtectedRoute>
      } />

      <Route path="/attendance" element={
        <ProtectedRoute roles={['STUDENT']}>
          <AttendancePage />
        </ProtectedRoute>
      } />

      {/* Teacher pages */}
      <Route path="/attendance/mark" element={
        <ProtectedRoute roles={['TEACHER', 'HOD', 'SUPER_ADMIN']}>
          <MarkAttendancePage />
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
