<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'
import EmailAuthForm from '@/components/EmailAuthForm.vue'
import type { CurrentUser } from '@/api/auth-types'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { getAccountPreview } from '@/utils/accountPreview'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const authStore = useAuthStore()
const syncStore = useSyncStore()
const accountPreview = getAccountPreview()
const displayedUser = computed(() => authStore.user ?? accountPreview?.user ?? null)
const isPreviewing = computed(() => !authStore.user && Boolean(accountPreview))
const displayedSyncTone = computed(() => (
  authStore.user ? syncStore.indicatorTone : accountPreview?.tone ?? syncStore.indicatorTone
))
const displayedStatusLabel = computed(() => (
  isPreviewing.value ? accountPreview?.statusLabel : syncStore.statusLabel
))
const emailMode = ref<'none' | 'sign-in' | 'bind'>('none')
const securityMessage = ref('')
const canBindEmail = computed(() => {
  const user = authStore.user
  return Boolean(
    user
    && user.authMethods.passkey
    && !user.authMethods.email
    && !user.emailVerified,
  )
})
const canAddPasskey = computed(() => {
  const user = authStore.user
  return Boolean(user?.authMethods.email && !user.authMethods.passkey)
})

const avatarText = computed(() => displayedUser.value?.nickname.slice(0, 1) ?? '')
const syncDetail = computed(() => {
  if (isPreviewing.value) return accountPreview?.syncDetail
  if (syncStore.errorMessage) return syncStore.errorMessage
  if (syncStore.lastSyncedAt) {
    return `上次同步 ${new Date(syncStore.lastSyncedAt).toLocaleString()}`
  }
  return '登录状态下会自动同步本机数据'
})
type FlipAnimation =
  | ''
  | 'flip-enter-out'
  | 'flip-enter-in'
  | 'flip-exit-out'
  | 'flip-exit-in'

const displayedRegistrationSuggested = ref(authStore.registrationSuggested)
const flipAnimation = ref<FlipAnimation>('')
const isFlipping = ref(false)
let flipTimer: ReturnType<typeof setTimeout> | null = null

function waitForFlip(duration: number): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return nextTick()
  }
  return new Promise(resolve => {
    flipTimer = setTimeout(() => {
      flipTimer = null
      resolve()
    }, duration)
  })
}

async function flipToAuthMode(targetRegistrationSuggested: boolean): Promise<void> {
  if (
    isFlipping.value ||
    displayedRegistrationSuggested.value === targetRegistrationSuggested
  ) return

  isFlipping.value = true
  flipAnimation.value = targetRegistrationSuggested ? 'flip-enter-out' : 'flip-exit-out'
  await waitForFlip(160)

  displayedRegistrationSuggested.value = targetRegistrationSuggested
  if (authStore.registrationSuggested !== targetRegistrationSuggested) {
    if (targetRegistrationSuggested) authStore.suggestRegistration()
    else authStore.showLogin()
  }
  await nextTick()

  flipAnimation.value = targetRegistrationSuggested ? 'flip-enter-in' : 'flip-exit-in'
  await waitForFlip(240)
  flipAnimation.value = ''
  isFlipping.value = false
}

watch(
  () => authStore.registrationSuggested,
  targetRegistrationSuggested => {
    if (!props.show) {
      displayedRegistrationSuggested.value = targetRegistrationSuggested
      return
    }
    void flipToAuthMode(targetRegistrationSuggested)
  },
)

watch(
  () => props.show,
  show => {
    if (!show) {
      emailMode.value = 'none'
      securityMessage.value = ''
      return
    }
    displayedRegistrationSuggested.value = authStore.registrationSuggested
    flipAnimation.value = ''
    isFlipping.value = false
  },
)

onUnmounted(() => {
  if (flipTimer) clearTimeout(flipTimer)
})

function close(): void {
  emit('update:show', false)
}

function syncAccount(): void {
  if (!isPreviewing.value) void syncStore.syncNow(true)
}

function logoutAccount(): void {
  if (!isPreviewing.value) void authStore.logout()
}

async function switchAccount(): Promise<void> {
  if (isPreviewing.value || !await authStore.logout()) return
  authStore.showLogin()
}

function handleEmailAuthenticated(
  user: CurrentUser,
  otherSessionsRevoked = true,
): void {
  if (emailMode.value === 'bind') {
    if (!authStore.refreshAuthenticatedUser(user)) {
      handleAccountMismatch()
      return
    }
    securityMessage.value = otherSessionsRevoked
      ? '邮箱已绑定，现在可以使用邮箱验证码登录当前账户'
      : '邮箱已绑定，但未能退出其他设备；请重新登录并检查账户安全'
  } else {
    authStore.acceptAuthenticatedUser(user)
  }
  emailMode.value = 'none'
}

function handleAccountMismatch(): void {
  emailMode.value = 'none'
  securityMessage.value = '账户身份发生异常变化，已停止同步，请退出后重新登录'
  syncStore.handleSignedOut()
  void authStore.logout()
}

function handleSessionExpired(): void {
  emailMode.value = 'none'
  securityMessage.value = '登录状态已失效，请重新登录'
  void authStore.restoreSession()
}

function addPasskeyToAccount(): void {
  if (!isPreviewing.value) void authStore.register()
}
</script>

<template>
  <ImmersiveSheet
    :show="props.show"
    :radius="24"
    :swipe-to-dismiss="!isFlipping"
    swipe-handle="[data-sheet-swipe-handle]"
    class="account-popup"
    :class="[
      { 'immersive-popup-flip--flipping': isFlipping },
      flipAnimation ? `immersive-popup-flip--${flipAnimation}` : '',
    ]"
    :aria-busy="isFlipping"
    aria-label="账户"
    @update:show="emit('update:show', $event)"
  >
    <section class="account-card" aria-labelledby="account-card-title">
      <div class="account-sheet-handle" data-sheet-swipe-handle aria-hidden="true">
        <span />
      </div>
      <button class="account-close" type="button" aria-label="关闭" @click="close">
        <van-icon name="cross" size="18" />
      </button>

      <template v-if="authStore.isRestoring">
        <van-loading size="30" color="#007aff" />
        <h2 id="account-card-title">正在读取账户</h2>
        <p>你的本地训练记录会照常保留</p>
      </template>

      <template v-else-if="displayedUser && emailMode === 'bind'">
        <EmailAuthForm
          mode="bind"
          :expected-user-id="authStore.user?.id"
          @authenticated="handleEmailAuthenticated"
          @cancel="emailMode = 'none'"
          @account-mismatch="handleAccountMismatch"
          @session-expired="handleSessionExpired"
        />
      </template>

      <template v-else-if="displayedUser">
        <div class="account-avatar-shell">
          <div class="account-avatar account-avatar--signed-in">
            <img
              v-if="displayedUser.image"
              :src="displayedUser.image"
              alt="用户头像"
            />
            <span v-else>{{ avatarText }}</span>
          </div>
        </div>
        <h2 id="account-card-title">{{ displayedUser.nickname }}</h2>
        <div class="account-security-card">
          <div class="account-security-row">
            <span>
              <van-icon name="envelop-o" size="16" />
              邮箱
            </span>
            <small>
              {{ displayedUser.authMethods.email ? displayedUser.email : '未绑定' }}
            </small>
          </div>
          <div class="account-security-row">
            <span>
              <van-icon name="shield-o" size="16" />
              通行密钥
            </span>
            <small>{{ displayedUser.authMethods.passkey ? '已启用' : '未添加' }}</small>
          </div>
          <button
            v-if="canBindEmail"
            class="account-security-button"
            type="button"
            @click="emailMode = 'bind'"
          >
            绑定邮箱作为恢复方式
          </button>
          <button
            v-else-if="canAddPasskey"
            class="account-security-button"
            type="button"
            :disabled="authStore.isAuthenticating || !authStore.passkeySupported"
            @click="addPasskeyToAccount"
          >
            <van-loading
              v-if="authStore.isAuthenticating"
              size="16"
              color="currentColor"
            />
            {{ authStore.isAuthenticating ? '正在添加…' : '为当前账户添加通行密钥' }}
          </button>
        </div>
        <div
          v-if="securityMessage || authStore.errorMessage"
          class="account-message"
          :class="{ 'account-message--error': authStore.errorMessage }"
        >
          {{ authStore.errorMessage || securityMessage }}
        </div>
        <div
          class="account-feature-note"
          :class="`account-feature-note--${displayedSyncTone}`"
        >
          <span class="account-feature-status">
            <i
              class="account-sync-indicator account-sync-indicator--inline"
              :class="`account-sync-indicator--${displayedSyncTone}`"
              aria-hidden="true"
            />
            {{ displayedStatusLabel }}
          </span>
          <small>{{ syncDetail }}</small>
        </div>
        <div v-if="syncStore.phase === 'account-mismatch'" class="account-sync-decision">
          <button
            class="account-sync-button"
            type="button"
            @click="close"
          >
            保留本地数据，暂不同步
          </button>
          <button
            class="account-sync-merge-button"
            type="button"
            :disabled="authStore.isAuthenticating"
            @click="switchAccount"
          >
            {{ authStore.isAuthenticating ? '正在退出…' : '切换回原账户' }}
          </button>
          <small>不会覆盖、迁移或删除本机训练数据。</small>
        </div>
        <div v-else-if="syncStore.phase === 'decision-required'" class="account-sync-decision">
          <button
            class="account-sync-button"
            type="button"
            @click="syncStore.useCloudData"
          >
            使用云端数据（推荐）
          </button>
          <button
            class="account-sync-merge-button"
            type="button"
            @click="syncStore.mergeLocalData"
          >
            合并本机数据
          </button>
          <small>合并后，本机数据会同步到其他设备和排行榜。</small>
        </div>
        <button
          v-else
          class="account-sync-button"
          type="button"
          :disabled="displayedSyncTone === 'syncing'"
          @click="syncAccount"
        >
          <van-icon name="replay" size="17" />
          立即同步
        </button>
        <div class="account-action-divider" aria-hidden="true" />
        <button
          class="account-secondary-button"
          type="button"
          :disabled="authStore.isAuthenticating"
          @click="logoutAccount"
        >
          {{ authStore.isAuthenticating ? '正在退出…' : '退出登录' }}
        </button>
      </template>

      <template v-else-if="emailMode === 'sign-in'">
        <EmailAuthForm
          mode="sign-in"
          @authenticated="handleEmailAuthenticated"
          @cancel="emailMode = 'none'"
        />
      </template>

      <template v-else>
        <div class="account-avatar">
          <van-icon name="user-o" size="30" />
        </div>
        <h2 id="account-card-title">
          {{ displayedRegistrationSuggested ? '创建通行密钥' : '通行密钥登录' }}
        </h2>
        <p v-if="displayedRegistrationSuggested">
          创建后即可登录，无需设置密码。
        </p>
        <p v-else>
          使用指纹、面容或锁屏密码登录。
        </p>

        <div v-if="!authStore.passkeySupported" class="account-message">
          当前环境不支持通行密钥，本地记录不受影响。
        </div>
        <div v-else-if="authStore.errorMessage" class="account-message account-message--error">
          {{ authStore.errorMessage }}
        </div>

        <button
          v-if="displayedRegistrationSuggested"
          class="account-primary-button"
          type="button"
          :disabled="authStore.isAuthenticating || !authStore.passkeySupported"
          @click="authStore.register"
        >
          <van-loading v-if="authStore.isAuthenticating" size="18" color="currentColor" />
          <van-icon v-else name="shield-o" size="19" />
          {{ authStore.isAuthenticating ? '正在创建…' : '创建并登录' }}
        </button>
        <button
          v-else
          class="account-primary-button"
          type="button"
          :disabled="authStore.isAuthenticating || !authStore.passkeySupported"
          @click="authStore.login"
        >
          <van-loading v-if="authStore.isAuthenticating" size="18" color="currentColor" />
          <van-icon v-else name="shield-o" size="19" />
          {{ authStore.isAuthenticating ? '正在验证…' : '登录' }}
        </button>

        <button
          v-if="authStore.passkeySupported"
          class="account-text-button"
          type="button"
          :disabled="authStore.isAuthenticating"
          @click="flipToAuthMode(!displayedRegistrationSuggested)"
        >
          {{ displayedRegistrationSuggested ? '已有通行密钥？登录' : '创建通行密钥' }}
        </button>
        <div class="account-login-divider">
          <span>或</span>
        </div>
        <button
          class="account-email-button"
          type="button"
          :disabled="authStore.isAuthenticating"
          @click="emailMode = 'sign-in'"
        >
          <van-icon name="envelop-o" size="18" />
          使用邮箱验证码
        </button>
        <small>训练记录保存在本机</small>
      </template>
    </section>
  </ImmersiveSheet>
</template>

<style scoped>
.account-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 42px 24px calc(24px + env(safe-area-inset-bottom));
  border-radius: 24px;
  background: #fff;
  text-align: center;
}

.account-sheet-handle {
  position: absolute;
  top: 0;
  right: 52px;
  left: 52px;
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.account-sheet-handle span {
  width: 36px;
  height: 5px;
  border-radius: 999px;
  background: rgba(60, 60, 67, 0.22);
}

.account-close {
  position: absolute;
  top: 12px;
  right: 14px;
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #f2f2f7;
  color: #636366;
}

.account-avatar {
  display: flex;
  width: 68px;
  height: 68px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 50%;
  background: linear-gradient(145deg, #eef6ff, #dbeaff);
  color: #007aff;
}

.account-avatar-shell {
  position: relative;
  margin-bottom: 12px;
}

.account-avatar-shell .account-avatar {
  margin-bottom: 0;
}

.account-avatar--signed-in {
  overflow: hidden;
  background: linear-gradient(145deg, #2f95ff, #0068db);
  color: #fff;
  font-size: 26px;
  font-weight: 650;
}

.account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-sync-indicator {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
}

.account-sync-indicator--inline {
  position: static;
}

.account-sync-indicator--synced {
  background: #34c759;
  box-shadow: 0 0 8px rgba(52, 199, 89, 0.85);
}

.account-sync-indicator--pending {
  background: #ff9500;
  box-shadow: 0 0 8px rgba(255, 149, 0, 0.8);
}

.account-sync-indicator--syncing {
  background: #ffd60a;
  box-shadow: 0 0 8px rgba(255, 214, 10, 0.85);
}

h2 {
  margin: 0;
  color: #1c1c1e;
  font-size: 22px;
  line-height: 1.25;
}

p {
  max-width: 310px;
  margin: 9px 0 20px;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.55;
}

.account-feature-note,
.account-message,
.account-security-card {
  width: 100%;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f2f7ff;
  color: #44617e;
  font-size: 13px;
  line-height: 1.45;
}

.account-security-card {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  background: #f7f7f9;
}

.account-security-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}

.account-security-row span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #3a3a3c;
  font-weight: 600;
}

.account-security-row small {
  overflow: hidden;
  color: #6e6e73;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-security-button {
  min-height: 38px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: #eaf4ff;
  color: #2876c7;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.account-feature-note {
  display: grid;
  gap: 3px;
  margin-top: 18px;
  transition: background-color 0.2s ease;
}

.account-feature-note--synced {
  background: #edf9f0;
}

.account-feature-note--pending {
  background: #fff4e5;
}

.account-feature-note--syncing {
  background: #fffbe3;
}

.account-feature-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.account-feature-note span {
  color: #1c1c1e;
  font-weight: 600;
}

.account-feature-note small {
  color: #6e6e73;
  line-height: 1.4;
}

.account-message--error {
  background: #fff3f1;
  color: #b42318;
}

.account-primary-button,
.account-secondary-button,
.account-sync-button,
.account-email-button {
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.account-email-button {
  background: #eaf4ff;
  color: #2876c7;
}

.account-login-divider {
  position: relative;
  width: 100%;
  height: 20px;
  margin: 10px 0;
  color: #8e8e93;
  font-size: 11px;
}

.account-login-divider::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 1px;
  background: rgba(60, 60, 67, 0.14);
  content: '';
}

.account-login-divider span {
  position: relative;
  padding: 0 10px;
  background: #fff;
}

.account-sync-decision {
  display: grid;
  width: 100%;
  gap: 10px;
}

.account-sync-merge-button {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  background: #f2f2f7;
  color: #1c1c1e;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.account-sync-decision small {
  color: #8e8e93;
  line-height: 1.4;
}

.account-primary-button {
  background: #111;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  color: #fff;
}

.account-secondary-button {
  margin-top: 0;
  background: #f2f2f7;
  color: #ff3b30;
}

.account-sync-button {
  background: #eaf4ff;
  color: #2876c7;
}

.account-action-divider {
  width: 100%;
  height: 1px;
  margin: 24px 0 16px;
  background: rgba(60, 60, 67, 0.16);
}

.account-primary-button:disabled,
.account-secondary-button:disabled,
.account-sync-button:disabled,
.account-email-button:disabled,
.account-security-button:disabled,
.account-text-button:disabled {
  opacity: 0.5;
}

.account-text-button {
  margin: 14px 0 6px;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: #007aff;
  font: inherit;
  font-size: 13px;
}

small {
  color: #8e8e93;
  font-size: 11px;
}

@media (prefers-color-scheme: dark) {
  .account-card {
    background: #1c1c1e;
  }

  .account-sheet-handle span {
    background: rgba(235, 235, 245, 0.3);
  }

  .account-close,
  .account-secondary-button {
    background: #2c2c2e;
  }

  .account-avatar {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(145deg, #24364a, #18283a);
    color: #64a9f3;
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.05);
  }

  .account-avatar--signed-in {
    border-color: rgba(255, 255, 255, 0.12);
    background: linear-gradient(145deg, #1674d1, #064b91);
    color: #fff;
  }

  .account-close,
  p,
  small {
    color: #aeaeb2;
  }

  h2 {
    color: #fff;
  }

  .account-feature-note,
  .account-message,
  .account-security-card {
    background: #2c2c2e;
    color: #d1d1d6;
  }

  .account-security-row span {
    color: #fff;
  }

  .account-security-row small {
    color: #aeaeb2;
  }

  .account-security-button,
  .account-email-button {
    background: rgba(10, 132, 255, 0.16);
    color: #64a9f3;
  }

  .account-login-divider::before {
    background: rgba(235, 235, 245, 0.16);
  }

  .account-login-divider span {
    background: #1c1c1e;
  }

  .account-feature-note--synced {
    background: rgba(52, 199, 89, 0.14);
  }

  .account-feature-note--pending {
    background: rgba(255, 149, 0, 0.14);
  }

  .account-feature-note--syncing {
    background: rgba(255, 214, 10, 0.14);
  }

  .account-feature-note span {
    color: #fff;
  }

  .account-feature-note small {
    color: #aeaeb2;
  }

  .account-message--error {
    background: rgba(255, 69, 58, 0.14);
    color: #ff6961;
  }

  .account-primary-button {
    background: #fff;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
    color: #111;
  }

  .account-sync-button {
    background: rgba(10, 132, 255, 0.16);
    color: #64a9f3;
  }

  .account-action-divider {
    background: rgba(235, 235, 245, 0.16);
  }

  .account-sync-merge-button {
    background: #2c2c2e;
    color: #fff;
  }
}
</style>
