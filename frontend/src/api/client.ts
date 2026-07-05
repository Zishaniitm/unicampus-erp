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

    if (status === 401 || code === 'ERR-AUTH-003') {
      // Session expired — redirect to login
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status === 403) {
      toast.error('You do not have permission to perform this action.')
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
