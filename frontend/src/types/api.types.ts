export interface ApiSuccess<T> {
  success: true
  data:    T
  meta?:   PaginationMeta
}

export interface ApiError {
  success: false
  error: {
    code:      string
    message:   string
    error_id:  string
    timestamp: string
    errors?:   Record<string, string[]>
  }
}

export interface PaginationMeta {
  page:        number
  per_page:    number
  total:       number
  total_pages: number
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
