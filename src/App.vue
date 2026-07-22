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
  <div id="app-popup-root" />
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
}

</style>

<style scoped>
.app-container,
.main-content {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

#app-popup-root {
  position: absolute;
  z-index: 2000;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
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
