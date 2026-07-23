import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  AuthenticationError,
  canTryPasskey,
  getCurrentUser,
  isPasskeyCancellation,
  registerPasskey,
  signInWithPasskey,
  signOut,
  type CurrentUser,
} from '@/api/auth'

function getAuthenticationMessage(error: unknown): string {
  if (error instanceof TypeError) return '暂时无法连接认证服务，本地记录不受影响'
  if (!(error instanceof AuthenticationError)) return '操作未完成，请稍后重试'
  if (error.status === 429) return '操作过于频繁，请稍后再试'
  if (error.status === 403) return '当前页面来源不受认证服务信任'
  if (error.status && error.status >= 500) return '云服务暂时不可用，本地记录不受影响'

  switch (error.code) {
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return '这个通行密钥已经注册，请直接登录'
    case 'ERROR_INVALID_DOMAIN':
    case 'ERROR_INVALID_RP_ID':
      return '当前域名不符合通行密钥安全要求'
    default:
      return '操作未完成，请稍后重试'
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  const isRestoring = ref(false)
  const isAuthenticating = ref(false)
  const errorMessage = ref('')
  const registrationSuggested = ref(false)
  const passkeySupported = computed(() => canTryPasskey())

  async function restoreSession(): Promise<void> {
    if (isRestoring.value) return
    isRestoring.value = true
    errorMessage.value = ''
    try {
      user.value = await getCurrentUser()
    } catch (error) {
      user.value = null
      errorMessage.value = getAuthenticationMessage(error)
    } finally {
      isRestoring.value = false
    }
  }

  async function login(): Promise<boolean> {
    if (isAuthenticating.value || !passkeySupported.value) return false
    isAuthenticating.value = true
    errorMessage.value = ''
    try {
      user.value = await signInWithPasskey()
      registrationSuggested.value = user.value === null
      return user.value !== null
    } catch (error) {
      registrationSuggested.value = true
      if (!isPasskeyCancellation(error)) {
        errorMessage.value = getAuthenticationMessage(error)
      }
      return false
    } finally {
      isAuthenticating.value = false
    }
  }

  async function register(): Promise<boolean> {
    if (isAuthenticating.value || !passkeySupported.value) return false
    isAuthenticating.value = true
    errorMessage.value = ''
    try {
      user.value = await registerPasskey()
      registrationSuggested.value = false
      return user.value !== null
    } catch (error) {
      if (!isPasskeyCancellation(error)) {
        errorMessage.value = getAuthenticationMessage(error)
      }
      return false
    } finally {
      isAuthenticating.value = false
    }
  }

  async function logout(): Promise<boolean> {
    if (isAuthenticating.value) return false
    isAuthenticating.value = true
    errorMessage.value = ''
    try {
      await signOut()
      user.value = null
      registrationSuggested.value = false
      return true
    } catch (error) {
      errorMessage.value = getAuthenticationMessage(error)
      return false
    } finally {
      isAuthenticating.value = false
    }
  }

  function suggestRegistration(): void {
    registrationSuggested.value = true
    errorMessage.value = ''
  }

  function showLogin(): void {
    registrationSuggested.value = false
    errorMessage.value = ''
  }

  return {
    user,
    isRestoring,
    isAuthenticating,
    errorMessage,
    registrationSuggested,
    passkeySupported,
    restoreSession,
    login,
    register,
    logout,
    suggestRegistration,
    showLogin,
  }
})
