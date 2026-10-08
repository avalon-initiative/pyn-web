<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import styles from './styles/App.module.scss'
import PynFileList from './components/PynFileList.vue'
import { fetchLocks } from './api/client'
import type { FileRow } from './types/lock.types'

const rows = ref<FileRow[]>([])
const error = ref('')
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

async function refresh() {
  now.value = new Date()
  try {
    const locks = await fetchLocks()
    rows.value = locks.map((lock) => ({ path: lock.path, mode: 'exclusive', lock }))
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <main :class="styles.page">
    <h1 :class="styles.title">Locked files</h1>
    <p v-if="error" :class="styles.error" role="alert">Could not reach pyn-server: {{ error }}</p>
    <PynFileList :rows="rows" :now="now" />
  </main>
</template>
