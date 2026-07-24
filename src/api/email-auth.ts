import type {
  APIErrorBody,
  CurrentUser,
  CurrentUserResponse,
} from '@/api/auth-types'

export const authOrigin = import.meta.env.DEV
  ? 'http://localhost:8787'
  : window.location.origin

export class AuthRequestError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfter: number | null

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfter: number | null,
  ) {
    super(message)
    this.name = 'AuthRequestError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}

export class AccountIdentityChangedError extends Error {
  constructor() {
    super('ACCOUNT_ID_CHANGED_UNEXPECTEDLY')
    this.name = 'AccountIdentityChangedError'
  }
}

export interface EmailBindingResult {
  user: CurrentUser
  otherSessionsRevoked: boolean
}

async function requestJSON<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${authOrigin}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  const body = await response.json().catch(() => null) as
    | T
    | APIErrorBody
    | null

  if (!response.ok) {
    const error = body as APIErrorBody | null
    const retryAfterHeader = Number(response.headers.get('Retry-After'))
    const retryAfterBody = Number(error?.retryAfter)
    const retryAfter = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader
      : Number.isFinite(retryAfterBody) && retryAfterBody > 0
        ? retryAfterBody
        : null

    throw new AuthRequestError(
      error?.code ?? `HTTP_${response.status}`,
      error?.message ?? '认证服务暂时不可用',
      response.status,
      retryAfter,
    )
  }

  if (!body) {
    throw new AuthRequestError(
      'INVALID_RESPONSE',
      '认证服务返回异常',
      response.status,
      null,
    )
  }
  return body as T
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validateEmail(value: string): boolean {
  const normalized = normalizeEmail(value)
  return normalized.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
}

export function validateOTP(value: string): boolean {
  return /^\d{6}$/u.test(value)
}

export async function sendSignInCode(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail)
  if (!validateEmail(email)) {
    throw new AuthRequestError('INVALID_EMAIL', '邮箱格式不正确', 400, null)
  }

  await requestJSON<{ success: true }>(
    '/api/auth/email-otp/send-verification-otp',
    {
      method: 'POST',
      body: JSON.stringify({
        email,
        type: 'sign-in',
      }),
    },
  )
}

export async function signInWithEmailOTP(
  rawEmail: string,
  rawOTP: string,
): Promise<CurrentUser> {
  const email = normalizeEmail(rawEmail)
  const otp = rawOTP.trim()
  if (!validateEmail(email)) {
    throw new AuthRequestError('INVALID_EMAIL', '邮箱格式不正确', 400, null)
  }
  if (!validateOTP(otp)) {
    throw new AuthRequestError('INVALID_OTP', '请输入 6 位数字验证码', 400, null)
  }

  await requestJSON<unknown>(
    '/api/auth/sign-in/email-otp',
    {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    },
  )
  return getCurrentUser()
}

export async function requestEmailBinding(rawEmail: string): Promise<void> {
  const newEmail = normalizeEmail(rawEmail)
  if (!validateEmail(newEmail)) {
    throw new AuthRequestError('INVALID_EMAIL', '邮箱格式不正确', 400, null)
  }

  await requestJSON<{ success: true }>(
    '/api/auth/email-otp/request-email-change',
    {
      method: 'POST',
      body: JSON.stringify({ newEmail }),
    },
  )
}

export async function confirmEmailBinding(
  rawEmail: string,
  rawOTP: string,
  expectedUserId: string,
): Promise<EmailBindingResult> {
  const newEmail = normalizeEmail(rawEmail)
  const otp = rawOTP.trim()
  if (!validateEmail(newEmail) || !validateOTP(otp)) {
    throw new AuthRequestError(
      'INVALID_INPUT',
      '邮箱或验证码格式不正确',
      400,
      null,
    )
  }

  await requestJSON<{ success: true }>(
    '/api/auth/email-otp/change-email',
    {
      method: 'POST',
      body: JSON.stringify({ newEmail, otp }),
    },
  )

  const user = await getCurrentUser()
  if (user.id !== expectedUserId) {
    throw new AccountIdentityChangedError()
  }

  let otherSessionsRevoked = true
  try {
    await requestJSON<{ status: true }>(
      '/api/auth/revoke-other-sessions',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    )
  } catch {
    otherSessionsRevoked = false
  }

  return { user, otherSessionsRevoked }
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const result = await requestJSON<CurrentUserResponse>(
    '/api/me',
    { method: 'GET' },
  )
  return result.user
}
