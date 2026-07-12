import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/auth.api'
import type { AuthState, User, LoginInput } from '@/types/auth.types'

/**
 * Global auth store using Zustand.
 * Persists minimal user info in localStorage for UI purposes.
 * The actual session is managed via HttpOnly cookies on the backend —
 * localStorage is only used to avoid a loading flash on page refresh.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:          null,
      isLoading:     false,
      isInitialized: false,

      setUser: (user: User | null) => set({ user }),

      /**
       * Called on app startup to verify the session cookie is still valid.
       * If it is, populate the user store. If not, clear it.
       */
      initialize: async () => {
  if (get().isInitialized) return
  // Mark initialized FIRST to prevent any re-calls
  set({ isInitialized: true })
  try {
    const user = await authApi.me()
    set({ user })
  } catch {
    // No session — stay on login, don't loop
    set({ user: null })
  }
},

      login: async (input: LoginInput) => {
        set({ isLoading: true })
        try {
          const user = await authApi.login(input)
          set({ user, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } finally {
          set({ user: null })
          // Clear persisted state
          localStorage.removeItem('unicampus-auth')
        }
      },
    }),
    {
      name:    'unicampus-auth',
      // Only persist minimal info — session truth is in HttpOnly cookie
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
