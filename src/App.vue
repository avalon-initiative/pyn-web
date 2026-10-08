<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import styles from './styles/App.module.scss'
import PynFileList from './components/PynFileList.vue'
import { ApiError, fetchFiles, fetchMe } from './api/client'
import { loadCredential, saveCredential } from './state/credential.state'
import { groupByTopLevel } from './state/files.state'
import type { FileRow, Me } from './types/lock.types'

const NOT_SIGNED_IN = 'Not signed in: enter a token or user name above.'

const rows = ref<FileRow[]>([])
const me = ref<Me | null>(null)
const error = ref('')
const now = ref(new Date())
const credential = ref(loadCredential())
let timer: ReturnType<typeof setInterval> | undefined

const groups = computed(() => groupByTopLevel(rows.value))
const lockedCount = computed(() => rows.value.filter((r) => r.lock).length)

function describe(e: unknown): string {
  if (e instanceof ApiError) {
    return e.status === 401 && !credential.value ? NOT_SIGNED_IN : e.message
  }
  return `Could not reach pyn-server: ${e instanceof Error ? e.message : String(e)}`
}

async function refresh() {
  now.value = new Date()
  if (!credential.value) {
    me.value = null
    rows.value = []
    error.value = NOT_SIGNED_IN
    return
  }
  try {
    me.value = await fetchMe(credential.value)
    rows.value = await fetchFiles(credential.value)
    error.value = ''
  } catch (e) {
    me.value = null
    rows.value = []
    error.value = describe(e)
  }
}

watch(credential, (value) => {
  saveCredential(value)
  refresh()
})

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
        <p :class="styles.summary">
          <template v-if="me">Signed in as {{ me.user }} · </template>{{ rows.length }} files,
          {{ lockedCount }} locked
        </p>
      </div>
      <label :class="styles.identity">
        Sign in
        <input
          v-model.trim="credential"
          :class="styles.input"
          type="password"
          autocomplete="off"
          placeholder="token or dev user"
        />
      </label>
    </header>
    <p v-if="error" :class="styles.error" role="alert">{{ error }}</p>
    <section v-for="group in groups" :key="group.name" :class="styles.group">
      <h2 :class="styles.groupTitle">{{ group.name }}</h2>
      <PynFileList :rows="group.rows" :me="me?.user" :now="now" />
    </section>
  </main>
</template>
