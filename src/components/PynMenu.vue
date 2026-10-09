<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import styles from '../styles/PynMenu.module.scss'
import type { MenuItem } from '../types/shell.types'

defineProps<{ label: string; items: MenuItem[]; align?: 'start' | 'end' }>()
const emit = defineEmits<{ select: [id: string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const away = (e: Event) => {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
const escape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') open.value = false
}
const stop = () => {
  document.removeEventListener('click', away)
  document.removeEventListener('keydown', escape)
}
watch(open, (o) => {
  if (!o) return stop()
  document.addEventListener('click', away)
  document.addEventListener('keydown', escape)
})
onBeforeUnmount(stop)

function choose(id: string) {
  open.value = false
  emit('select', id)
}
</script>

<template>
  <div ref="root" :class="styles.menu">
    <button
      type="button"
      :class="styles.trigger"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <slot />
    </button>
    <div v-if="open" :class="[styles.panel, align === 'start' && styles.start]" role="menu">
      <slot name="header" />
      <template v-for="item in items" :key="item.id">
        <hr v-if="item.separator" :class="styles.separator" />
        <a
          v-else-if="item.href"
          :href="item.href"
          :class="styles.item"
          role="menuitem"
          @click="open = false"
          >{{ item.label }}</a
        >
        <button
          v-else
          type="button"
          :class="styles.item"
          :role="item.checked === undefined ? 'menuitem' : 'menuitemradio'"
          :aria-checked="item.checked"
          @click="choose(item.id)"
        >
          <span :class="styles.check">{{ item.checked ? '✓' : '' }}</span
          >{{ item.label }}
        </button>
      </template>
    </div>
  </div>
</template>
