import { createRouter, createWebHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'
import AccountView from './views/AccountView.vue'
import KeysView from './views/KeysView.vue'
import NewRepoView from './views/NewRepoView.vue'
import RepoBlobView from './views/RepoBlobView.vue'
import RepoAuditView from './views/RepoAuditView.vue'
import RepoFilesView from './views/RepoFilesView.vue'
import RepoHistoryView from './views/RepoHistoryView.vue'
import RepoInvitesView from './views/RepoInvitesView.vue'
import RepoLocksView from './views/RepoLocksView.vue'
import RepoMembersView from './views/RepoMembersView.vue'
import RepoRolesView from './views/RepoRolesView.vue'
import RepoSettingsView from './views/RepoSettingsView.vue'
import RepoView from './views/RepoView.vue'
import ReposView from './views/ReposView.vue'

// Account pages live under "/_/": a user name has at least two characters, so it cannot collide.
export const routes = [
  { path: '/', name: 'repos', component: ReposView },
  { path: '/_/new', name: 'new-repo', component: NewRepoView },
  {
    path: '/_/settings',
    component: AccountView,
    children: [
      { path: '', redirect: '/_/settings/keys' },
      { path: 'keys', name: 'keys', component: KeysView, alias: '/_/keys' },
    ],
  },
  {
    path: '/:owner/:name',
    component: RepoView,
    children: [
      { path: '', name: 'files', component: RepoFilesView },
      { path: 'tree/:path(.*)?', name: 'tree', component: RepoFilesView },
      { path: 'blob/:path(.+)', name: 'blob', component: RepoBlobView },
      { path: 'locks', name: 'locks', component: RepoLocksView },
      { path: 'history', name: 'history', component: RepoHistoryView },
      { path: 'audit', name: 'audit', component: RepoAuditView },
      { path: 'members', name: 'members', component: RepoMembersView },
      { path: 'roles', name: 'roles', component: RepoRolesView },
      { path: 'invites', name: 'invites', component: RepoInvitesView },
      { path: 'settings', name: 'settings', component: RepoSettingsView },
    ],
  },
]

export const makeRouter = (history: RouterHistory = createWebHistory()) =>
  createRouter({ history, routes })
