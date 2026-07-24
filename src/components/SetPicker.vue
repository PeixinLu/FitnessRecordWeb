<script setup lang="ts">
import { computed } from 'vue'
import NumberWheelPicker from '@/components/NumberWheelPicker.vue'
import type { TemplateField, TemplateFieldKey } from '@/utils/dataTemplate'

interface Props {
  fields: TemplateField[]
  values: Record<TemplateFieldKey, number>
  weightValues?: number[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  change: [values: Record<TemplateFieldKey, number>]
}>()

const pickerValue = computed({
  get: () => props.fields.map(field => props.values[field.key]),
  set: values => {
    const nextValues = { ...props.values }
    props.fields.forEach((field, index) => {
      nextValues[field.key] = values[index] ?? nextValues[field.key]
    })
    emit('change', nextValues)
  },
})

</script>

<template>
  <NumberWheelPicker
    v-model="pickerValue"
    :count="fields.length"
    :units="fields.map(field => field.unit)"
    :ranges="fields.map(field => field.range)"
    :values="fields.map(field => field.key === 'weight' ? weightValues : undefined)"
  />
</template>
