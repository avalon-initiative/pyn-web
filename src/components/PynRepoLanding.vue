<script setup lang="ts">
import { computed } from 'vue'
import PynActivity from './PynActivity.vue'
import PynBranchBar from './PynBranchBar.vue'
import PynBreadcrumb from './PynBreadcrumb.vue'
import PynCheckoutCard from './PynCheckoutCard.vue'
import PynLockedFiles from './PynLockedFiles.vue'
import PynReadme from './PynReadme.vue'
import PynRepoDetails from './PynRepoDetails.vue'
import PynTree from './PynTree.vue'
import styles from '../styles/PynRepoLanding.module.scss'
import { breadcrumbs, treePath } from '../state/tree.state'
import type { ReadmeDoc } from '../types/blob.types'
import type { RepoInfo } from '../types/repo.types'
import type { RepoSummary, TreeListing } from '../types/tree.types'

const props = defineProps<{
  repo: RepoInfo
  path: string
  listing?: TreeListing | null
  summary?: RepoSummary | null
  /** The folder does not exist (`path_not_found`). */
  missing?: boolean
  /** The folder's README, when it has one. */
  readme?: ReadmeDoc | null
  me?: string
  now?: Date
}>()

const crumbs = computed(() => breadcrumbs(props.repo, props.path))
</script>

<template>
  <div :class="styles.landing">
    <div :class="styles.main">
      <PynBranchBar
        v-if="summary"
        :branch="summary.default_branch"
        :files="summary.files"
        :updated-at="summary.updated_at"
        :now="now"
      />
      <PynBreadcrumb :crumbs="crumbs" />
      <div v-if="missing" :class="styles.missing" role="alert">
        <p>
          There is no folder <code>/{{ path }}</code> in this repository.
        </p>
        <a :href="treePath(repo, '')">Back to the top</a>
      </div>
      <PynTree
        v-else-if="listing"
        :entries="listing.entries"
        :owner="repo.owner"
        :name="repo.name"
        :me="me"
        :now="now"
      />
      <PynReadme v-if="readme && !missing" :readme="readme" :owner="repo.owner" :name="repo.name" />
      <PynCheckoutCard />
    </div>
    <aside v-if="summary" :class="styles.rail" aria-label="Repository summary">
      <PynRepoDetails
        :owner="repo.owner"
        :visibility="repo.visibility"
        :lease-hours="repo.lease_hours"
        :created-at="repo.created_at"
        :updated-at="summary.updated_at"
        :files="summary.files"
        :exclusive-files="summary.exclusive_files"
        :shared-files="summary.shared_files"
        :now="now"
      />
      <PynLockedFiles
        :locks="summary.locks"
        :owner="repo.owner"
        :name="repo.name"
        :me="me"
        :now="now"
      />
      <PynActivity :entries="summary.activity" :now="now" />
    </aside>
  </div>
</template>
