<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { checkout, createBranch, fetchContent, fetchPolicy, fetchTree } from '../api/repos'
import { useAction } from '../state/action.state'
import { repoKey, sessionKey } from '../state/context.state'
import { canWrite } from '../state/freeze.state'
import { useBranch } from '../state/branch.state'
import { useBranchDialog } from '../state/branch-dialog.state'
import { useHashScroll } from '../state/hash.state'
import { toggled } from '../state/file-tree.state'
import { ruleLine } from '../state/policy.state'
import {
  PynBranchDialog,
  PynFileView,
  ancestorFolders,
  contentUrl,
  entryAt,
  fileBody,
  fileKind,
  folderParam,
  lineHash,
  blobPath,
  parentOf,
  parseLineHash,
  repoPath,
  treePath,
  VIEW_LIMIT,
  type FileBody,
  type LineRange,
  type TreeEntry,
  PynViewError,
} from '@avalon-initiative/pyn-common-ui'

const {
  target,
  permissions,
  frozen,
  branches,
  branchesLoading,
  branchesError,
  selectBranch,
  reloadBranches,
  tags,
  tagsLoading,
  tagsError,
  tagsHref,
} = inject(repoKey)!
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
// Children by folder path ('' is the root); the panel gets them flattened.
const loaded = ref<Record<string, TreeEntry[]>>({})
const expanded = ref<string[]>([])
const treeLoading = ref<string[]>([])
const tree = computed(() => Object.values(loaded.value).flat())
const creatable = computed(() => canWrite(permissions.value.includes('checkin'), frozen.value))
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

// Another open folder that fails to read keeps what it had: the file itself does not depend on it.
async function loadFolder(folder: string, b?: string) {
  const listing = await fetchTree(target.value, folder, b)
  if (b === branch.value) loaded.value = { ...loaded.value, [folder]: listing.entries }
  return listing
}

async function refresh() {
  now.value = new Date()
  const p = path.value
  const b = branch.value
  expanded.value = [...new Set([...expanded.value, ...ancestorFolders(p)])]
  const parent = parentOf(p)
  const others = ['', ...expanded.value].filter((f) => f !== parent)
  void Promise.allSettled(others.map((f) => loadFolder(f, b)))
  await attempt(async () => {
    let found: TreeEntry | undefined
    try {
      const tree = await loadFolder(parent, b)
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

watch(branch, () => {
  loaded.value = {}
})

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

const toggleFolder = (folder: string) =>
  attempt(async () => {
    expanded.value = toggled(expanded.value, folder)
    if (!expanded.value.includes(folder) || loaded.value[folder]) return
    treeLoading.value = [...treeLoading.value, folder]
    try {
      await loadFolder(folder, branch.value)
    } finally {
      treeLoading.value = treeLoading.value.filter((f) => f !== folder)
    }
  })

const open = (file: string) => router.push(blobPath(target.value, file, branch.value))

const create = (name: string) =>
  attempt(async () => {
    await createBranch(target.value, name, branch.value)
    await reloadBranches?.()
    await selectBranch?.(name)
  })

const dialog = useBranchDialog({
  create: async (name, from) => {
    await createBranch(target.value, name, from)
    await reloadBranches?.()
    await selectBranch?.(name)
  },
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
  <PynFileView
    :owner="target.owner"
    :name="target.name"
    :path="path"
    :branch="branch"
    :entry="entry"
    :body="body"
    :missing="missing"
    :note="rule || undefined"
    :me="user"
    :now="now"
    :lines="lines"
    :lockable="lockable"
    :tree="tree"
    :expanded="expanded"
    :tree-loading="treeLoading"
    :branches="branches"
    :branches-loading="branchesLoading"
    :branches-error="branchesError || undefined"
    :tags="tags"
    :tags-loading="tagsLoading"
    :tags-error="tagsError || undefined"
    :tags-href="tagsHref"
    :branches-href="branches?.length ? repoPath(target, 'branches') : undefined"
    :creatable="creatable"
    :new-branch-button="creatable"
    @select-lines="selectLines"
    @lock="lock"
    @toggle-folder="toggleFolder"
    @open="open"
    @select-branch="(name, kind) => selectBranch?.(name, kind)"
    @create-branch="create"
    @new-branch="dialog.openCreate(branch)"
  />
  <PynBranchDialog
    :open="dialog.open.value"
    mode="create"
    :from="dialog.from.value"
    :branches="branches ?? []"
    :busy="dialog.busy.value"
    :error="dialog.error.value || undefined"
    @close="dialog.close"
    @create="dialog.create"
  />
</template>
