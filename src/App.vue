<script setup lang="ts">
import { onMounted } from 'vue'
import { useExerciseStore } from '@/stores/exercise'
import { useRecordStore } from '@/stores/record'
import { showLoadingToast, closeToast } from 'vant'

const exerciseStore = useExerciseStore()
const recordStore = useRecordStore()

onMounted(async () => {
  showLoadingToast({ message: '加载中...', forbidClick: true })
  await exerciseStore.loadData()
  await recordStore.loadRecords()
  closeToast()
})
</script>

<template>
  <div class="app-container">
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style>
/* 全局样式 */
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: #f5f5f7;
}

#app {
  min-height: 100vh;
  background-color: #f5f5f7;
}
</style>

<style scoped>
.app-container,
.main-content {
  min-height: 100vh;
  min-height: 100dvh;
}

.main-content {
  transform-origin: top center;
  transition: transform 0.28s ease, border-radius 0.28s ease;
}

.app-container:has(.home-page.secondary-page-open) .main-content {
  transform: scale3d(0.97, 0.97, 1);
  border-radius: 24px;
  overflow: hidden;
}

.app-container:has(.home-page.nested-secondary-page-open) .main-content {
  transform: scale3d(0.94, 0.94, 1);
}
</style>
