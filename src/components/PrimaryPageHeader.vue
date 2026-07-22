<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PrimaryPageTitle from '@/components/PrimaryPageTitle.vue'

interface PageAction {
  name: string
  path: string
  disabled?: boolean
}

defineProps<{ title: string }>()

const slots = useSlots()
const route = useRoute()
const router = useRouter()
const showMenu = ref(false)
const menuButtonRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

const actions = computed<PageAction[]>(() =>
  [
    { name: '记录', path: '/' },
    { name: '日历', path: '/calendar' },
    { name: '统计', path: '/statistics' },
    { name: '设置', path: '/settings' },
  ].map(action => ({
    ...action,
    disabled: action.path === route.path,
  })),
)

function navigateToPage(action: PageAction): void {
  showMenu.value = false
  if (action.path !== route.path) router.push(action.path)
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!showMenu.value || !(event.target instanceof Node)) return
  if (
    menuButtonRef.value?.contains(event.target) ||
    menuRef.value?.contains(event.target)
  ) {
    return
  }
  showMenu.value = false
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') showMenu.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown)
})
</script>

<template>
  <header class="primary-page-header">
    <PrimaryPageTitle :title="title" />

    <div v-smooth-corners="16" class="primary-page-menu-capsule">
      <template v-if="slots.action">
        <slot name="action" />
        <span class="primary-page-menu-divider" />
      </template>

      <button
        ref="menuButtonRef"
        class="primary-page-menu-button"
        type="button"
        aria-label="切换页面"
        :aria-expanded="showMenu"
        aria-haspopup="menu"
        @click="showMenu = !showMenu"
      >
        <span class="primary-page-menu-dots" aria-hidden="true">
          <span /><span /><span />
        </span>
      </button>
    </div>

    <Transition name="primary-page-menu">
      <nav
        v-if="showMenu"
        ref="menuRef"
        class="primary-page-menu"
        aria-label="页面导航"
      >
        <button
          v-for="action in actions"
          :key="action.path"
          type="button"
          :disabled="action.disabled"
          :aria-current="action.disabled ? 'page' : undefined"
          @click="navigateToPage(action)"
        >
          {{ action.name }}
          <van-icon v-if="action.disabled" name="success" />
        </button>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.primary-page-header {
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.primary-page-header :deep(.primary-page-title) {
  flex: 1;
  padding-right: 0;
}

.primary-page-menu-capsule {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin-right: 16px;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.primary-page-menu-button {
  display: flex;
  align-items: center;
  padding: 8px 11px;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.primary-page-menu-button:active {
  background: rgba(0, 0, 0, 0.06);
}

.primary-page-menu-dots {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.primary-page-menu-dots span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #8e8e93;
}

.primary-page-menu-divider {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.1);
}

.primary-page-menu {
  position: absolute;
  top: calc(100% - 6px);
  right: 16px;
  z-index: 50;
  display: grid;
  width: 156px;
  padding: 6px;
  border: 1px solid rgba(60, 60, 67, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.primary-page-menu button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #1c1c1e;
  font: inherit;
  font-size: 15px;
  text-align: left;
}

.primary-page-menu button:active:not(:disabled) {
  background: rgba(0, 122, 255, 0.1);
}

.primary-page-menu button:disabled {
  color: #007aff;
  opacity: 1;
}

.primary-page-menu-enter-active,
.primary-page-menu-leave-active {
  transition:
    opacity 140ms ease,
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top right;
}

.primary-page-menu-enter-from,
.primary-page-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

:slotted(.primary-page-header-action) {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 0;
  background: transparent;
  color: #1c1c1e;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

:slotted(.primary-page-header-action:active) {
  background: rgba(0, 0, 0, 0.06);
}

@media (prefers-color-scheme: dark) {
  .primary-page-menu-capsule {
    background: rgba(58, 58, 60, 0.76);
  }

  .primary-page-menu-divider {
    background: rgba(255, 255, 255, 0.15);
  }

  .primary-page-menu {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(44, 44, 46, 0.94);
  }

  .primary-page-menu button {
    color: #fff;
  }

  .primary-page-menu button:disabled {
    color: #0a84ff;
  }

  :slotted(.primary-page-header-action) {
    color: #fff;
  }
}
</style>
