<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { checkout, fetchContent, fetchPolicy, fetchTree } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import { useBranch } from '../state/branch.state'
import { useHashScroll } from '../state/hash.state'
import { ruleLine } from '../state/policy.state'
import {
  PynFileView,
  contentUrl,
  entryAt,
  fileBody,
  fileKind,
  folderParam,
  lineHash,
  parentOf,
  parseLineHash,
  treePath,
  VIEW_LIMIT,
  type FileBody,
  type LineRange,
  type TreeEntry,
  PynViewError,
  PynViewSummary,
} from '@avalon-initiative/pyn-common-ui'

const { target, permissions, frozen } = inject(repoKey)!
const user = inject(sessionKey)!.user
const route = useRoute()
const router = useRouter()
const path = computed(() => folderParam(route.params.path))
const branch = useBranch()
const entry = ref<TreeEntry | null>(null)
const body = ref<FileBody | null>(null)
const missing = ref(false)
const rule = ref('')
const lines = computed(() => parseLineHash(route.hash))
const now = ref(new Date())
const { error, attempt } = useAction()
const lockable = computed(() => canWrite(permissions.value.includes('lock'), frozen.value))
let loadedRevision: number | null = null
let timer: ReturnType<typeof setInterval> | undefined

async function bodyFor(p: string, e: TreeEntry, b?: string): Promise<FileBody> {
  if (!e.last_change) return { kind: 'none' }
  if (fileKind(p) === 'image') {
    return { kind: 'image', src: contentUrl(target.value, p, undefined, b) }
  }
  return fileBody(p, await fetchContent(target.value, p, VIEW_LIMIT, undefined, b))
}

// The rule line is a convenience: a failed read shows none.
async function loadRule(p: string) {
  try {
    const { paths } = await fetchPolicy(target.value, [p])
    if (p === path.value) rule.value = ruleLine(paths?.[0])
  } catch {
    if (p === path.value) rule.value = ''
  }
}

async function refresh() {
  now.value = new Date()
  const p = path.value
  const b = branch.value
  await attempt(async () => {
    let found: TreeEntry | undefined
    try {
      const tree = await fetchTree(target.value, parentOf(p), b)
      const hit = entryAt(tree.entries, p)
      if (hit?.kind === 'folder') {
        if (p === path.value) await router.replace(treePath(target.value, p, b))
        return
      }
      found = hit ?? undefined
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'path_not_found')) throw e
    }
    if (p !== path.value || b !== branch.value) return
    missing.value = !found
    entry.value = found ?? null
    if (!found) return
    void loadRule(p)
    const revision = found.last_change?.id ?? null
    if (body.value && revision === loadedRevision) return
    const next = await bodyFor(p, found, b)
    if (p !== path.value || b !== branch.value) return
    body.value = next
    loadedRevision = revision
  })
}

watch([path, branch], () => {
  entry.value = null
  body.value = null
  missing.value = false
  rule.value = ''
  loadedRevision = null
  refresh()
})

const lock = () =>
  attempt(async () => {
    await checkout(target.value, path.value, entry.value?.last_change?.id)
    await refresh()
  })

const selectLines = (r: LineRange) => router.push({ hash: lineHash(r) })
useHashScroll(() => body.value)

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 15_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <PynViewError v-if="error">{{ error }}</PynViewError>
  <PynViewSummary v-if="rule" data-policy-rule>{{ rule }}</PynViewSummary>
  <PynFileView
    :owner="target.owner"
    :name="target.name"
    :path="path"
    :branch="branch"
    :entry="entry"
    :body="body"
    :missing="missing"
    :me="user"
    :now="now"
    :lines="lines"
    :lockable="lockable"
    @select-lines="selectLines"
    @lock="lock"
  />
</template>
