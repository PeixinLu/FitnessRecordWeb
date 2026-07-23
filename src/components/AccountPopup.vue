<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const authStore = useAuthStore()
const syncStore = useSyncStore()

const avatarText = computed(() => authStore.user?.nickname.slice(0, 1) ?? '')
const syncDetail = computed(() => {
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
    if (!show) return
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

      <template v-else-if="authStore.user">
        <div class="account-avatar account-avatar--signed-in">
          <img
            v-if="authStore.user.image"
            :src="authStore.user.image"
            alt="用户头像"
          />
          <span v-else>{{ avatarText }}</span>
        </div>
        <span class="account-status"><i /> 已登录</span>
        <h2 id="account-card-title">{{ authStore.user.nickname }}</h2>
        <p>已通过通行密钥登录</p>
        <div class="account-feature-note">
          <span>{{ syncStore.statusLabel }}</span>
          <small>{{ syncDetail }}</small>
        </div>
        <div v-if="syncStore.phase === 'decision-required'" class="account-sync-decision">
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
          :disabled="syncStore.phase === 'syncing' || syncStore.phase === 'checking'"
          @click="syncStore.syncNow(true)"
        >
          <van-icon name="replay" size="17" />
          立即同步
        </button>
        <button
          class="account-secondary-button"
          type="button"
          :disabled="authStore.isAuthenticating"
          @click="authStore.logout"
        >
          {{ authStore.isAuthenticating ? '正在退出…' : '退出登录' }}
        </button>
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

.account-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  color: #34c759;
  font-size: 12px;
  font-weight: 600;
}

.account-status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
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
.account-message {
  width: 100%;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #f2f7ff;
  color: #44617e;
  font-size: 13px;
  line-height: 1.45;
}

.account-feature-note {
  display: grid;
  gap: 3px;
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
.account-sync-button {
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
  margin-top: 10px;
  background: #f2f2f7;
  color: #ff3b30;
}

.account-sync-button {
  background: #111;
  color: #fff;
}

.account-primary-button:disabled,
.account-secondary-button:disabled,
.account-sync-button:disabled,
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

  .account-close,
  p,
  small {
    color: #aeaeb2;
  }

  h2 {
    color: #fff;
  }

  .account-feature-note,
  .account-message {
    background: #2c2c2e;
    color: #d1d1d6;
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
    background: #fff;
    color: #111;
  }

  .account-sync-merge-button {
    background: #2c2c2e;
    color: #fff;
  }
}
</style>
