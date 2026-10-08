<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import styles from './styles/App.module.scss'
import PynFileList from './components/PynFileList.vue'
import { fetchFiles } from './api/client'
import { groupByTopLevel } from './state/files.state'
import type { FileRow } from './types/lock.types'

const USER_KEY = 'pyn.user'

function storedUser(): string {
  try {
    return localStorage.getItem(USER_KEY) ?? ''
  } catch {
    return ''
  }
}

const rows = ref<FileRow[]>([])
const error = ref('')
const now = ref(new Date())
const me = ref(storedUser())
let timer: ReturnType<typeof setInterval> | undefined

const groups = computed(() => groupByTopLevel(rows.value))
const lockedCount = computed(() => rows.value.filter((r) => r.lock).length)

watch(me, (user) => {
  try {
    localStorage.setItem(USER_KEY, user)
  } catch {
    // Storage is optional; the identity just resets on reload.
  }
})

async function refresh() {
  now.value = new Date()
  try {
    rows.value = await fetchFiles()
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
    <header :class="styles.header">
      <div>
        <h1 :class="styles.title">Files</h1>
        <p :class="styles.summary">{{ rows.length }} files, {{ lockedCount }} locked</p>
      </div>
      <label :class="styles.identity">
        Viewing as
        <input v-model.trim="me" :class="styles.input" placeholder="your name" />
      </label>
    </header>
    <p v-if="error" :class="styles.error" role="alert">Could not reach pyn-server: {{ error }}</p>
    <section v-for="group in groups" :key="group.name" :class="styles.group">
      <h2 :class="styles.groupTitle">{{ group.name }}</h2>
      <PynFileList :rows="group.rows" :me="me" :now="now" />
    </section>
  </main>
</template>
