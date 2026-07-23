<script setup lang="ts">
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'
import { useSyncStore } from '@/stores/sync'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const syncStore = useSyncStore()

async function useCloud(): Promise<void> {
  emit('update:show', false)
  await syncStore.useCloudData()
}

async function mergeLocal(): Promise<void> {
  emit('update:show', false)
  await syncStore.mergeLocalData()
}
</script>

<template>
  <ImmersiveSheet
    :show="props.show"
    :radius="24"
    swipe-handle="[data-sheet-swipe-handle]"
    aria-label="选择同步方式"
    @update:show="emit('update:show', $event)"
  >
    <section class="sync-decision-card">
      <div class="sync-decision-handle" data-sheet-swipe-handle aria-hidden="true">
        <span />
      </div>
      <div class="sync-decision-icon">
        <van-icon name="exchange" size="27" />
      </div>
      <h2>本机和云端都有数据</h2>
      <p>请选择本次登录后要使用的数据。系统不会根据名称或日期自动去重。</p>

      <button class="sync-decision-primary" type="button" @click="useCloud">
        使用云端数据
        <small>推荐</small>
      </button>
      <button class="sync-decision-secondary" type="button" @click="mergeLocal">
        合并本机数据
      </button>
      <div class="sync-decision-warning">
        合并后，本机数据将上传到账号，并同步到其他设备和排行榜。
      </div>
    </section>
  </ImmersiveSheet>
</template>

<style scoped>
.sync-decision-card {
  position: relative;
  padding: 44px 24px calc(24px + env(safe-area-inset-bottom));
  background: #fff;
  text-align: center;
}

.sync-decision-handle {
  position: absolute;
  top: 0;
  right: 48px;
  left: 48px;
  display: flex;
  height: 34px;
  align-items: center;
  justify-content: center;
}

.sync-decision-handle span {
  width: 36px;
  height: 5px;
  border-radius: 999px;
  background: rgba(60, 60, 67, 0.22);
}

.sync-decision-icon {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  border-radius: 50%;
  background: #f2f2f7;
  color: #111;
}

h2 {
  margin: 0;
  color: #1c1c1e;
  font-size: 22px;
}

p {
  margin: 10px auto 20px;
  max-width: 360px;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.55;
}

.sync-decision-primary,
.sync-decision-secondary {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.sync-decision-primary {
  background: #111;
  color: #fff;
}

.sync-decision-primary small {
  margin-left: 6px;
  opacity: 0.65;
  font-size: 11px;
}

.sync-decision-secondary {
  margin-top: 10px;
  background: #f2f2f7;
  color: #1c1c1e;
}

.sync-decision-warning {
  margin-top: 14px;
  color: #8e8e93;
  font-size: 11px;
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .sync-decision-card {
    background: #1c1c1e;
  }

  .sync-decision-handle span {
    background: rgba(235, 235, 245, 0.3);
  }

  .sync-decision-icon,
  .sync-decision-secondary {
    background: #2c2c2e;
    color: #fff;
  }

  h2 {
    color: #fff;
  }

  p {
    color: #aeaeb2;
  }

  .sync-decision-primary {
    background: #fff;
    color: #111;
  }
}
</style>
