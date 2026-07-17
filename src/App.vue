<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useExerciseStore } from '@/stores/exercise'
import { useRecordStore } from '@/stores/record'
import { useRoute } from 'vue-router'
import { showLoadingToast, closeToast } from 'vant'

const exerciseStore = useExerciseStore()
const recordStore = useRecordStore()
const route = useRoute()

// 当前路由名称
const currentRoute = computed(() => route.name as string)

// 底栏项目
const tabItems = [
  { name: 'home', icon: 'wap-home-o', label: '记录', activeIcon: 'wap-home' },
  { name: 'calendar', icon: 'calendar-o', label: '日历', activeIcon: 'calendar-o' },
  { name: 'statistics', icon: 'bar-chart-o', label: '统计', activeIcon: 'bar-chart-o' },
  { name: 'settings', icon: 'setting-o', label: '设置', activeIcon: 'setting' },
]

onMounted(async () => {
  showLoadingToast({ message: '加载中...', forbidClick: true })
  await exerciseStore.loadData()
  await recordStore.loadRecords()
  closeToast()
})
</script>

<template>
  <div class="app-container">
    <!-- 内容区 -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- 悬浮底栏 - macOS 26风格 -->
    <nav class="floating-tabbar">
      <router-link
        v-for="item in tabItems"
        :key="item.name"
        :to="item.name === 'home' ? '/' : `/${item.name}`"
        class="tab-item"
        :class="{ active: currentRoute === item.name || (item.name === 'home' && currentRoute === 'home') }"
      >
      <van-icon :name="currentRoute === item.name ? item.activeIcon : item.icon" size="20" />
        <span class="tab-label">{{ item.label }}</span>
      </router-link>
    </nav>
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
.app-container {
  min-height: 100vh;
  padding-bottom: 68px; /* 为悬浮底栏留空间 */
}

.main-content {
  min-height: 100%;
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

/* 悬浮底栏 - macOS 26 风格 */
.floating-tabbar {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 400px;
  height: 54px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 27px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  z-index: 1000;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  flex: 1;
  padding: 4px 0;
  border-radius: 12px;
  color: #8e8e93;
  text-decoration: none;
  transition: all 0.2s ease;
  min-width: 0;
}

.tab-item.active {
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 999px;
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .floating-tabbar {
    background: rgba(30, 30, 30, 0.85);
  }

  .tab-item {
    color: #8e8e93;
  }

  .tab-item.active {
    color: #0a84ff;
    background: rgba(10, 132, 255, 0.15);
  }
}
</style>
