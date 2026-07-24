<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import type { CurrentUser } from '@/api/auth-types'
import {
  AccountIdentityChangedError,
  AuthRequestError,
  confirmEmailBinding,
  getCurrentUser,
  normalizeEmail,
  requestEmailBinding,
  sendSignInCode,
  signInWithEmailOTP,
  validateEmail,
  validateOTP,
} from '@/api/email-auth'

type EmailAuthPhase = 'idle' | 'sending' | 'waiting-code' | 'verifying'

const props = defineProps<{
  mode: 'sign-in' | 'bind'
  expectedUserId?: string
}>()

const emit = defineEmits<{
  authenticated: [user: CurrentUser, otherSessionsRevoked?: boolean]
  cancel: []
  'account-mismatch': []
  'session-expired': []
}>()

const email = ref('')
const otp = ref('')
const phase = ref<EmailAuthPhase>('idle')
const cooldownUntil = ref(0)
const verificationBlockedUntil = ref(0)
const now = ref(Date.now())
const emailLocked = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')
const emailInput = ref<HTMLInputElement>()
let active = true
let timer: number | undefined

const isWaitingCode = computed(() => emailLocked.value)
const cooldownSeconds = computed(() => (
  Math.max(0, Math.ceil((cooldownUntil.value - now.value) / 1000))
))
const verificationBlockedSeconds = computed(() => (
  Math.max(0, Math.ceil((verificationBlockedUntil.value - now.value) / 1000))
))
const canSend = computed(() => (
  phase.value !== 'sending'
  && phase.value !== 'verifying'
  && cooldownSeconds.value === 0
  && validateEmail(email.value)
))
const canVerify = computed(() => (
  phase.value === 'waiting-code'
  && verificationBlockedSeconds.value === 0
  && validateOTP(otp.value)
))
const title = computed(() => (
  props.mode === 'bind' ? '绑定邮箱' : '邮箱验证码登录'
))
const description = computed(() => (
  props.mode === 'bind'
    ? '绑定后可使用邮箱登录当前账户，训练数据归属不会改变。'
    : '首次验证会自动创建账户，已有邮箱将登录原账户。'
))

function startClock(): void {
  window.clearInterval(timer)
  now.value = Date.now()
  timer = window.setInterval(() => {
    now.value = Date.now()
    if (
      cooldownSeconds.value === 0
      && verificationBlockedSeconds.value === 0
    ) window.clearInterval(timer)
  }, 1_000)
}

function setCooldown(seconds: number): void {
  cooldownUntil.value = Math.max(
    cooldownUntil.value,
    Date.now() + seconds * 1_000,
  )
  startClock()
}

function setVerificationBlocked(seconds: number): void {
  verificationBlockedUntil.value = Math.max(
    verificationBlockedUntil.value,
    Date.now() + seconds * 1_000,
  )
  startClock()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return '网络暂时不可用，请稍后重试'
  if (!(error instanceof AuthRequestError)) return '操作未完成，请稍后重试'
  if (error.status >= 500) return '认证服务暂时不可用，请稍后重试'

  switch (error.code) {
    case 'INVALID_EMAIL':
      return '请输入有效的邮箱地址'
    case 'INVALID_OTP':
      return '验证码不正确，请重新检查'
    case 'OTP_EXPIRED':
      return '验证码已过期，请重新发送'
    case 'TOO_MANY_ATTEMPTS':
      return '此验证码已失效，请重新发送'
    case 'RATE_LIMITED':
      return '操作过于频繁，请在倒计时结束后重试'
    case 'EMAIL_ALREADY_IN_USE':
      return '该邮箱属于其他账户，请退出后使用该邮箱登录'
    case 'EMAIL_LOGIN_DISABLED':
      return '邮箱登录暂时不可用，请使用通行密钥'
    case 'UNAUTHENTICATED':
      return '登录状态已失效，请重新登录'
    case 'ORIGIN_NOT_ALLOWED':
      return '当前页面来源未被认证服务允许'
    default:
      return '操作未完成，请稍后重试'
  }
}

async function recoverAlreadyBound(): Promise<boolean> {
  if (props.mode !== 'bind' || !props.expectedUserId) return false
  try {
    const user = await getCurrentUser()
    if (!active) return true
    if (user.id !== props.expectedUserId) {
      emit('account-mismatch')
      return true
    }
    emit('authenticated', user)
    return true
  } catch {
    return false
  }
}

async function sendCode(): Promise<void> {
  if (!canSend.value) {
    if (!validateEmail(email.value)) {
      errorMessage.value = '请输入有效的邮箱地址'
      await nextTick()
      emailInput.value?.focus()
    }
    return
  }

  phase.value = 'sending'
  errorMessage.value = ''
  noticeMessage.value = ''
  const normalizedEmail = normalizeEmail(email.value)
  try {
    if (props.mode === 'bind') await requestEmailBinding(normalizedEmail)
    else await sendSignInCode(normalizedEmail)
    if (!active) return
    email.value = normalizedEmail
    otp.value = ''
    emailLocked.value = true
    setCooldown(60)
    phase.value = 'waiting-code'
    noticeMessage.value = '如果该邮箱可以接收邮件，验证码已发送。请检查收件箱和垃圾邮件。'
  } catch (error) {
    if (!active) return
    if (
      error instanceof AuthRequestError
      && error.code === 'EMAIL_ALREADY_BOUND'
      && await recoverAlreadyBound()
    ) return
    if (error instanceof AuthRequestError && error.retryAfter) {
      setCooldown(error.retryAfter)
    }
    if (
      error instanceof AuthRequestError
      && error.code === 'UNAUTHENTICATED'
      && props.mode === 'bind'
    ) emit('session-expired')
    phase.value = emailLocked.value ? 'waiting-code' : 'idle'
    errorMessage.value = getErrorMessage(error)
  }
}

async function verifyCode(): Promise<void> {
  if (!canVerify.value) return
  phase.value = 'verifying'
  errorMessage.value = ''
  try {
    if (props.mode === 'bind') {
      if (!props.expectedUserId) {
        emit('account-mismatch')
        return
      }
      const result = await confirmEmailBinding(
        email.value,
        otp.value,
        props.expectedUserId,
      )
      if (!active) return
      emit('authenticated', result.user, result.otherSessionsRevoked)
      return
    }

    const user = await signInWithEmailOTP(email.value, otp.value)
    if (!active) return
    emit('authenticated', user)
  } catch (error) {
    if (!active) return
    if (error instanceof AccountIdentityChangedError) {
      emit('account-mismatch')
      return
    }
    if (
      error instanceof AuthRequestError
      && ['OTP_EXPIRED', 'TOO_MANY_ATTEMPTS'].includes(error.code)
    ) {
      otp.value = ''
    }
    if (error instanceof AuthRequestError && error.retryAfter) {
      setVerificationBlocked(error.retryAfter)
    }
    phase.value = 'waiting-code'
    if (
      error instanceof AuthRequestError
      && error.code === 'UNAUTHENTICATED'
      && props.mode === 'bind'
    ) emit('session-expired')
    errorMessage.value = getErrorMessage(error)
  }
}

function modifyEmail(): void {
  otp.value = ''
  emailLocked.value = false
  cooldownUntil.value = 0
  verificationBlockedUntil.value = 0
  noticeMessage.value = ''
  errorMessage.value = ''
  phase.value = 'idle'
  void nextTick(() => emailInput.value?.focus())
}

function handleOTPInput(event: Event): void {
  const input = event.target as HTMLInputElement
  otp.value = input.value.replace(/\D/gu, '').slice(0, 6)
  input.value = otp.value
}

onUnmounted(() => {
  active = false
  otp.value = ''
  window.clearInterval(timer)
})
</script>

<template>
  <div class="email-auth-form">
    <button class="email-auth-back" type="button" @click="emit('cancel')">
      <van-icon name="arrow-left" size="17" />
      返回
    </button>

    <div class="email-auth-icon" aria-hidden="true">
      <van-icon name="envelop-o" size="28" />
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>

    <label class="email-auth-field">
      <span>邮箱地址</span>
      <input
        ref="emailInput"
        v-model="email"
        type="email"
        inputmode="email"
        autocomplete="email"
        maxlength="254"
        placeholder="name@example.com"
        :disabled="isWaitingCode || phase === 'sending'"
        @keydown.enter.prevent="sendCode"
      >
    </label>

    <template v-if="isWaitingCode">
      <button class="email-auth-change" type="button" @click="modifyEmail">
        修改邮箱
      </button>
      <label class="email-auth-field">
        <span>6 位验证码</span>
        <input
          :value="otp"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          pattern="[0-9]{6}"
          placeholder="000000"
          :disabled="phase === 'verifying'"
          @input="handleOTPInput"
          @keydown.enter.prevent="verifyCode"
        >
      </label>
    </template>

    <div v-if="noticeMessage" class="email-auth-notice">
      {{ noticeMessage }}
    </div>
    <div v-if="errorMessage" class="email-auth-error" role="alert">
      {{ errorMessage }}
    </div>

    <button
      v-if="!isWaitingCode"
      class="email-auth-primary"
      type="button"
      :disabled="!canSend"
      @click="sendCode"
    >
      <van-loading v-if="phase === 'sending'" size="18" color="currentColor" />
      {{
        phase === 'sending'
          ? '正在发送…'
          : cooldownSeconds > 0
            ? `${cooldownSeconds} 秒后可发送`
            : '获取验证码'
      }}
    </button>
    <button
      v-else
      class="email-auth-primary"
      type="button"
      :disabled="!canVerify"
      @click="verifyCode"
    >
      <van-loading v-if="phase === 'verifying'" size="18" color="currentColor" />
      {{
        phase === 'verifying'
          ? '正在验证…'
          : verificationBlockedSeconds > 0
            ? `${verificationBlockedSeconds} 秒后可重试`
            : props.mode === 'bind'
              ? '确认绑定'
              : '验证并登录'
      }}
    </button>

    <button
      v-if="isWaitingCode"
      class="email-auth-resend"
      type="button"
      :disabled="cooldownSeconds > 0 || phase === 'verifying'"
      @click="sendCode"
    >
      {{ cooldownSeconds > 0 ? `${cooldownSeconds} 秒后可重新发送` : '重新发送验证码' }}
    </button>
  </div>
</template>

<style scoped>
.email-auth-form {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
}

.email-auth-back {
  position: absolute;
  top: 14px;
  left: 16px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 6px 7px;
  border: 0;
  background: transparent;
  color: #007aff;
  font: inherit;
  font-size: 13px;
}

.email-auth-icon {
  display: flex;
  width: 60px;
  height: 60px;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  border-radius: 50%;
  background: #edf6ff;
  color: #2876c7;
}

h2 {
  margin: 0;
  color: #1c1c1e;
  font-size: 22px;
  line-height: 1.25;
}

p {
  max-width: 310px;
  margin: 9px 0 18px;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.5;
}

.email-auth-field {
  display: grid;
  width: 100%;
  gap: 7px;
  margin-bottom: 12px;
  text-align: left;
}

.email-auth-field span {
  padding-left: 3px;
  color: #636366;
  font-size: 12px;
  font-weight: 600;
}

.email-auth-field input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid rgba(60, 60, 67, 0.18);
  border-radius: 14px;
  outline: 0;
  background: #f7f7f9;
  color: #1c1c1e;
  font: inherit;
  font-size: 16px;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.email-auth-field input:focus {
  border-color: #5a9de2;
  box-shadow: 0 0 0 3px rgba(90, 157, 226, 0.14);
}

.email-auth-field input:disabled {
  color: #6e6e73;
  opacity: 0.8;
}

.email-auth-change {
  align-self: flex-end;
  margin: -8px 2px 10px;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: #2876c7;
  font: inherit;
  font-size: 12px;
}

.email-auth-notice,
.email-auth-error {
  width: 100%;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.45;
  text-align: left;
}

.email-auth-notice {
  background: #f2f7ff;
  color: #44617e;
}

.email-auth-error {
  background: #fff3f1;
  color: #b42318;
}

.email-auth-primary {
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 16px;
  background: #eaf4ff;
  color: #2876c7;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.email-auth-primary:disabled,
.email-auth-resend:disabled {
  opacity: 0.5;
}

.email-auth-resend {
  margin-top: 10px;
  padding: 5px 8px;
  border: 0;
  background: transparent;
  color: #2876c7;
  font: inherit;
  font-size: 12px;
}

@media (prefers-color-scheme: dark) {
  .email-auth-icon {
    background: rgba(10, 132, 255, 0.16);
    color: #64a9f3;
  }

  h2 {
    color: #fff;
  }

  p,
  .email-auth-field span {
    color: #aeaeb2;
  }

  .email-auth-field input {
    border-color: rgba(235, 235, 245, 0.16);
    background: #2c2c2e;
    color: #fff;
  }

  .email-auth-notice {
    background: #2c2c2e;
    color: #d1d1d6;
  }

  .email-auth-error {
    background: rgba(255, 69, 58, 0.14);
    color: #ff6961;
  }

  .email-auth-primary {
    background: rgba(10, 132, 255, 0.16);
    color: #64a9f3;
  }
}
</style>
