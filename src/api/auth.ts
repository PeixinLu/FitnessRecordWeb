import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/client'
import {
  authOrigin,
  getCurrentUser as requestCurrentUser,
} from '@/api/email-auth'
import type { CurrentUser } from '@/api/auth-types'

export { authOrigin }
export type { CurrentUser } from '@/api/auth-types'

export const authClient = createAuthClient({
  baseURL: authOrigin,
  plugins: [passkeyClient()],
})

interface AuthClientError {
  code?: string
  message?: string
  status?: number
}

export class AuthenticationError extends Error {
  code: string
  status?: number

  constructor(code: string, message: string, status?: number) {
    super(message)
    this.name = 'AuthenticationError'
    this.code = code
    this.status = status
  }
}

function toAuthenticationError(
  error: AuthClientError,
  fallbackCode: string,
): AuthenticationError {
  return new AuthenticationError(
    error.code ?? fallbackCode,
    error.message ?? fallbackCode,
    error.status,
  )
}

async function readRequestError(
  response: Response,
  fallbackCode: string,
): Promise<AuthenticationError> {
  try {
    const body = await response.json() as AuthClientError
    return toAuthenticationError(
      { ...body, status: response.status },
      fallbackCode,
    )
  } catch {
    return new AuthenticationError(fallbackCode, fallbackCode, response.status)
  }
}

export function canTryPasskey(): boolean {
  return window.isSecureContext
    && 'PublicKeyCredential' in window
    && Boolean(navigator.credentials)
}

export function isPasskeyCancellation(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return true
  if (!(error instanceof AuthenticationError)) return false
  return [
    'AUTH_CANCELLED',
    'ERROR_CEREMONY_ABORTED',
    'ERROR_CEREMONY_NOT_STARTED',
  ].includes(error.code)
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await requestCurrentUser()
  } catch (error) {
    if (
      error instanceof Error
      && 'status' in error
      && error.status === 401
    ) return null
    throw error
  }
}

export async function registerPasskey(): Promise<CurrentUser | null> {
  const contextResponse = await fetch(
    `${authOrigin}/api/passkey/registration-context`,
    {
      method: 'POST',
      credentials: 'include',
    },
  )

  if (!contextResponse.ok) {
    throw await readRequestError(
      contextResponse,
      'REGISTRATION_CONTEXT_FAILED',
    )
  }

  const { context } = await contextResponse.json() as {
    context: string
    expiresAt: string
  }
  const result = await authClient.passkey.addPasskey({
    name: '当前设备',
    context,
  })

  if (result.error) {
    throw toAuthenticationError(result.error, 'PASSKEY_REGISTRATION_FAILED')
  }
  return getCurrentUser()
}

export async function signInWithPasskey(): Promise<CurrentUser | null> {
  const result = await authClient.signIn.passkey({ autoFill: false })
  if (result.error) {
    throw toAuthenticationError(result.error, 'PASSKEY_SIGN_IN_FAILED')
  }
  return getCurrentUser()
}

export async function signOut(): Promise<void> {
  const result = await authClient.signOut()
  if (result.error) {
    throw toAuthenticationError(result.error, 'SIGN_OUT_FAILED')
  }
}
