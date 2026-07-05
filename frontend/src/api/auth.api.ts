import { api } from './client'
import type { User, LoginInput } from '@/types/auth.types'

export const authApi = {
  /** POST /api/v1/auth/login */
  login: async (input: LoginInput): Promise<User> => {
    const { data } = await api.post('/auth/login', input)
    return data.data.user
  },

  /** POST /api/v1/auth/logout */
  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  /** GET /api/v1/auth/me — verify session and get current user */
  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me')
    return data.data.user
  },

  /** POST /api/v1/auth/change-password */
  changePassword: async (input: { current_password: string; new_password: string }): Promise<void> => {
    await api.post('/auth/change-password', input)
  },

  /** POST /api/v1/auth/forgot-password */
  forgotPassword: async (mobile_number: string): Promise<void> => {
    await api.post('/auth/forgot-password', { mobile_number })
  },

  /** POST /api/v1/auth/reset-password */
  resetPassword: async (input: { mobile_number: string; otp: string; new_password: string }): Promise<void> => {
    await api.post('/auth/reset-password', input)
  },
}
