import axios from 'axios'
import toast from 'react-hot-toast'

/**
 * Axios instance — all API calls go through this.
 * Base URL proxied to backend via Vite config in development.
 * Credentials: true ensures HttpOnly cookies are sent on every request.
 */
export const api = axios.create({
  baseURL:         '/api/v1',
  withCredentials: true,   // Required for HttpOnly JWT cookies
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// Response interceptor — handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status
    const code    = error.response?.data?.error?.code
    const errorId = error.response?.data?.error?.error_id

    // Only redirect to login if NOT already on login/auth pages
    const onAuthPage = window.location.pathname.startsWith('/login') ||
                       window.location.pathname.startsWith('/change-password') ||
                       window.location.pathname.startsWith('/forgot-password')

    if ((status === 401 || code === 'ERR-AUTH-003') && !onAuthPage) {
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 403) {
      // Only show toast for user-initiated actions, not background widget queries
      // Widget queries are identified by not having a specific user action context
      const url = error.config?.url ?? ''
      const isWidgetQuery = url.includes('/my/summary') || url.includes('/my/balance') || url.includes('/my/issued')
      if (!isWidgetQuery) {
        toast.error('You do not have permission to perform this action.')
      }
      return Promise.reject(error)
    }

    if (status === 500) {
      const msg = errorId
        ? `Something went wrong. Error ID: ${errorId}`
        : 'An unexpected error occurred. Please try again.'
      toast.error(msg)
    }

    return Promise.reject(error)
  },
)