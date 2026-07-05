export interface User {
  user_id:              string
  username:             string
  role:                 Role
  must_change_password: boolean
  first_name?:          string
  last_name?:           string
  photo_url?:           string
}

export type Role =
  | 'SUPER_ADMIN'
  | 'PRINCIPAL'
  | 'ACCOUNT_OFFICER'
  | 'EXAM_CONTROLLER'
  | 'LIBRARIAN'
  | 'HOD'
  | 'TEACHER'
  | 'STAFF'
  | 'ADMISSION_STAFF'
  | 'STUDENT'
  | 'GUEST'

export interface LoginInput {
  username: string
  password: string
}

export interface AuthState {
  user:          User | null
  isLoading:     boolean
  isInitialized: boolean
  login:         (input: LoginInput) => Promise<void>
  logout:        () => Promise<void>
  setUser:       (user: User | null) => void
  initialize:    () => Promise<void>
}
