<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <h1 class="primary-page-title">{{ title }}</h1>
</template>

<style scoped>
.primary-page-title {
  margin: 0;
  padding: 18px 20px 10px;
  color: #1c1c1e;
  font-size: 34px;
  font-weight: 700;
  line-height: 41px;
  letter-spacing: -0.7px;
}

@media (prefers-color-scheme: dark) {
  .primary-page-title {
    color: #f5f5f7;
  }
}
</style>
