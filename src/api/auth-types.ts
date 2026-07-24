export interface AuthMethods {
  passkey: boolean
  email: boolean
}

export interface CurrentUser {
  id: string
  nickname: string
  image: string | null
  email: string | null
  emailVerified: boolean
  authMethods: AuthMethods
}

export interface CurrentSession {
  expiresAt: string
}

export interface CurrentUserResponse {
  user: CurrentUser
  session: CurrentSession
}

export interface APIErrorBody {
  code?: string
  message?: string
  retryAfter?: number
}
