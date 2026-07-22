<script setup lang="ts">
import { ref } from 'vue'
import ImmersiveSheet from '@/components/ImmersiveSheet.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const position = ref<'top' | 'bottom'>('bottom')

function closeDialog(): void {
  emit('update:show', false)
}

function togglePosition(): void {
  position.value = position.value === 'bottom' ? 'top' : 'bottom'
}
</script>

<template>
  <ImmersiveSheet
    :show="props.show"
    :position="position"
    height="72%"
    :radius="32"
    aria-label="自定义弹窗预设测试"
    @update:show="emit('update:show', $event)"
  >
    <template #header-left>
      <button class="debug-sheet-quiet-button" type="button" @click="closeDialog">
        关闭
      </button>
    </template>

    <template #header>
      弹窗预设测试
    </template>

    <template #header-right>
      <button class="debug-sheet-quiet-button" type="button" @click="togglePosition">
        {{ position === 'bottom' ? '置顶' : '置底' }}
      </button>
    </template>

    <div class="sheet-scroll-content debug-sheet-list">
      <div class="debug-sheet-intro">
        当前从{{ position === 'bottom' ? '底部' : '顶部' }}进入。列表内容会延伸至磨砂标题和操作区下方。
      </div>
      <div v-for="index in 14" :key="index" class="debug-sheet-item">
        <span>模拟列表内容 {{ index }}</span>
        <span>{{ index * 5 }} kg</span>
      </div>
    </div>

    <template #footer>
      <div class="debug-sheet-actions">
        <button class="debug-sheet-cancel" type="button" @click="closeDialog">
          取消
        </button>
        <button class="debug-sheet-confirm" type="button" @click="closeDialog">
          完成测试
        </button>
      </div>
    </template>
  </ImmersiveSheet>
</template>

<style scoped>
.debug-sheet-list {
  display: grid;
  align-content: start;
  gap: 10px;
  padding-inline: 18px;
}

.debug-sheet-intro {
  padding: 8px 2px 4px;
  color: #8e8e93;
  font-size: 13px;
  line-height: 1.45;
}

.debug-sheet-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 0 16px;
  border-radius: 16px;
  background: #f5f5f7;
  color: #1c1c1e;
  corner-shape: superellipse(1.2);
}

.debug-sheet-item span:last-child {
  color: #8e8e93;
  font-size: 13px;
}

.debug-sheet-quiet-button {
  min-width: 52px;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.82);
  color: #007aff;
  font: inherit;
  font-size: 14px;
}

.debug-sheet-actions {
  display: grid;
  grid-template-columns: 0.7fr 1.3fr;
  gap: 10px;
}

.debug-sheet-actions button {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  font: inherit;
  font-weight: 600;
  corner-shape: superellipse(1.2);
}

.debug-sheet-cancel {
  background: rgba(242, 242, 247, 0.9);
  color: #636366;
}

.debug-sheet-confirm {
  background: #007aff;
  color: #fff;
}
</style>
