<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import {
  enterImmersivePopupEnvironment,
  leaveImmersivePopupEnvironment,
} from '@/utils/immersivePopupEnvironment'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    show: boolean
    closeOnClickOutside?: boolean
    smoothCorners?: number | string
  }>(),
  {
    closeOnClickOutside: true,
    smoothCorners: 0,
  },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
  open: []
  close: []
  opened: []
  closed: []
  'click-outside': []
}>()

const environmentToken = Symbol('immersive-popup')
let environmentActive = false

function enterEnvironment(): void {
  if (environmentActive) return
  environmentActive = true
  enterImmersivePopupEnvironment(environmentToken)
}

function leaveEnvironment(): void {
  if (!environmentActive) return
  environmentActive = false
  leaveImmersivePopupEnvironment(environmentToken)
}

function closeFromOutside(): void {
  emit('click-outside')
  if (props.closeOnClickOutside) emit('update:show', false)
}

function onClosed(): void {
  emit('closed')
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      enterEnvironment()
      return
    }
    leaveEnvironment()
  },
  { immediate: true },
)

onBeforeUnmount(leaveEnvironment)
</script>

<template>
  <div
    v-if="props.show"
    class="immersive-popup-click-layer"
    aria-hidden="true"
    @click="closeFromOutside"
  />

  <van-popup
    v-bind="$attrs"
    v-smooth-corners="props.smoothCorners"
    :show="props.show"
    :overlay="false"
    position="center"
    :style="{
      top: '50%',
      right: 'auto',
      bottom: 'auto',
      left: '50%',
    }"
    @update:show="emit('update:show', $event)"
    @open="emit('open')"
    @close="emit('close')"
    @opened="emit('opened')"
    @closed="onClosed"
  >
    <slot />
  </van-popup>
</template>

<style scoped>
.immersive-popup-click-layer {
  position: absolute;
  z-index: 1999;
  inset: 0;
  background: transparent;
}
</style>
