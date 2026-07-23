<script setup lang="ts">
import { computed } from 'vue'
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const authStore = useAuthStore()

const avatarText = computed(() => authStore.user?.nickname.slice(0, 1) ?? '')

function close(): void {
  emit('update:show', false)
}
</script>

<template>
  <ImmersiveSheet
    :show="props.show"
    :radius="24"
    swipe-handle="[data-sheet-swipe-handle]"
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
        <p>已使用通行密钥安全登录</p>
        <div class="account-feature-note">
          后续可使用数据同步与训练排行等云端功能
        </div>
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
          {{ authStore.registrationSuggested ? '创建你的通行密钥' : '登录账户' }}
        </h2>
        <p v-if="authStore.registrationSuggested">
          没有找到可用的通行密钥？创建一个即可生成账户并登录。
        </p>
        <p v-else>
          使用设备上的指纹、面容或锁屏密码安全登录，无需记住密码。
        </p>

        <div v-if="!authStore.passkeySupported" class="account-message">
          当前浏览器或页面环境不支持通行密钥，你仍可继续使用本地记录。
        </div>
        <div v-else-if="authStore.errorMessage" class="account-message account-message--error">
          {{ authStore.errorMessage }}
        </div>

        <button
          v-if="authStore.registrationSuggested"
          class="account-primary-button"
          type="button"
          :disabled="authStore.isAuthenticating || !authStore.passkeySupported"
          @click="authStore.register"
        >
          <van-loading v-if="authStore.isAuthenticating" size="18" color="currentColor" />
          <van-icon v-else name="shield-o" size="19" />
          {{ authStore.isAuthenticating ? '正在创建…' : '创建通行密钥并登录' }}
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
          {{ authStore.isAuthenticating ? '等待系统验证…' : '使用通行密钥登录' }}
        </button>

        <button
          v-if="authStore.passkeySupported"
          class="account-text-button"
          type="button"
          :disabled="authStore.isAuthenticating"
          @click="authStore.registrationSuggested ? authStore.showLogin() : authStore.suggestRegistration()"
        >
          {{ authStore.registrationSuggested ? '我已有通行密钥，返回登录' : '首次使用？创建通行密钥' }}
        </button>
        <small>登录与退出不会删除设备上的训练记录</small>
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

.account-message--error {
  background: #fff3f1;
  color: #b42318;
}

.account-primary-button,
.account-secondary-button {
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

.account-primary-button {
  background: #111;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  color: #fff;
}

.account-secondary-button {
  background: #f2f2f7;
  color: #ff3b30;
}

.account-primary-button:disabled,
.account-secondary-button:disabled,
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

  .account-message--error {
    background: rgba(255, 69, 58, 0.14);
    color: #ff6961;
  }

  .account-primary-button {
    background: #fff;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
    color: #111;
  }
}
</style>
