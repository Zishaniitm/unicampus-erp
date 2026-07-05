import { useAuthStore } from '@/stores/auth.store'

/** Convenience hook — access auth state anywhere */
export function useAuth() {
  const user          = useAuthStore(s => s.user)
  const isLoading     = useAuthStore(s => s.isLoading)
  const isInitialized = useAuthStore(s => s.isInitialized)
  const login         = useAuthStore(s => s.login)
  const logout        = useAuthStore(s => s.logout)
  const initialize    = useAuthStore(s => s.initialize)

  return {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    role: user?.role ?? null,
    login,
    logout,
    initialize,
  }
}
