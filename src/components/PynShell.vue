<script setup lang="ts">
import { ref } from 'vue'
import PynIcon from './PynIcon.vue'
import styles from '../styles/PynShell.module.scss'

const open = ref(false)
const closeOnLink = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('a')) open.value = false
}
</script>

<template>
  <div :class="styles.shell">
    <header :class="styles.top">
      <button
        type="button"
        :class="styles.toggle"
        aria-label="Toggle navigation"
        :aria-expanded="open"
        @click="open = !open"
      >
        <PynIcon name="menu" />
      </button>
      <slot name="top" />
    </header>
    <aside :class="[styles.side, open && styles.open]" @click="closeOnLink">
      <slot name="side" />
    </aside>
    <main :class="styles.main">
      <div :class="styles.content"><slot /></div>
    </main>
  </div>
</template>
