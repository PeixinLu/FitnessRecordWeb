<script setup lang="ts">
import { computed, ref } from 'vue'
import NumberWheelPicker from '@/components/NumberWheelPicker.vue'

const workoutValue = ref([12, 4, 80])
const singleValue = ref([5])
const fourValue = ref([1, 10, 30, 60])

const workoutText = computed(() => JSON.stringify(workoutValue.value))
const singleText = computed(() => JSON.stringify(singleValue.value))
const fourText = computed(() => JSON.stringify(fourValue.value))
</script>

<template>
  <div class="debug-page">
    <header class="debug-header">
      <h1>数字滚轮调试</h1>
      <p>触摸上下滑动单列；桌面端将鼠标悬停到某列后滚动鼠标滚轮。</p>
    </header>

    <section v-smooth-corners="8" class="debug-section">
      <div class="section-title">
        <h2>训练参数</h2>
        <code>{{ workoutText }}</code>
      </div>
      <NumberWheelPicker
        v-model="workoutValue"
        :count="3"
        :units="['次', '组', 'kg']"
        :ranges="[[1, 50], [1, 10], [0, 200]]"
      />
    </section>

    <section v-smooth-corners="8" class="debug-section">
      <div class="section-title">
        <h2>单滚轮边界</h2>
        <code>{{ singleText }}</code>
      </div>
      <NumberWheelPicker
        v-model="singleValue"
        :count="1"
        :units="['档']"
        :ranges="[[1, 5]]"
      />
    </section>

    <section v-smooth-corners="8" class="debug-section">
      <div class="section-title">
        <h2>四滚轮上限</h2>
        <code>{{ fourText }}</code>
      </div>
      <NumberWheelPicker
        v-model="fourValue"
        :count="4"
        :units="['A', 'B', 'C', 'D']"
        :ranges="[[1, 3], [10, 12], [30, 35], [60, 65]]"
      />
    </section>
  </div>
</template>

<style scoped>
.debug-page {
  min-height: 100vh;
  padding: 20px 16px 96px;
  background: #f5f5f7;
}

.debug-header {
  margin-bottom: 20px;
}

.debug-header h1 {
  margin: 0 0 8px;
  color: #1c1c1e;
  font-size: 24px;
  font-weight: 700;
}

.debug-header p {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.5;
}

.debug-section {
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid #ececf0;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title h2 {
  margin: 0;
  color: #1c1c1e;
  font-size: 16px;
  font-weight: 600;
}

.section-title code {
  color: #007aff;
  font-size: 13px;
  white-space: nowrap;
}

@media (prefers-color-scheme: dark) {
  .debug-page {
    background: #1c1c1e;
  }

  .debug-header h1,
  .section-title h2 {
    color: #fff;
  }

  .debug-section {
    background: #2c2c2e;
    border-color: #3a3a3c;
  }
}
</style>
