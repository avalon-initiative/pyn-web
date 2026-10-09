import { createRouter, createWebHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'
import { scrollToHash } from './state/hash.state'
import AdminAccountsView from './views/AdminAccountsView.vue'
import AccountView from './views/AccountView.vue'
import KeysView from './views/KeysView.vue'
import MyLocksView from './views/MyLocksView.vue'
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
import VerifyEmailView from './views/VerifyEmailView.vue'
import NewOrgView from './views/NewOrgView.vue'
import OrgAuditView from './views/OrgAuditView.vue'
import OrgMembersView from './views/OrgMembersView.vue'
import OrgSettingsView from './views/OrgSettingsView.vue'
import OrgTeamsView from './views/OrgTeamsView.vue'
import OrgTeamView from './views/OrgTeamView.vue'
import OrgsView from './views/OrgsView.vue'
import OrgView from './views/OrgView.vue'
import OwnerView from './views/OwnerView.vue'
import RepoView from './views/RepoView.vue'
import ReposView from './views/ReposView.vue'

// Account pages live under "/_/" and organization pages under "/:owner/-/": neither "_" nor "-" can be a
// user, organization or repository name.
export const routes = [
  { path: '/', name: 'repos', component: ReposView },
  { path: '/verify-email', name: 'verify-email', component: VerifyEmailView },
  { path: '/_/locks', name: 'my-locks', component: MyLocksView },
  { path: '/_/admin/accounts', name: 'admin-accounts', component: AdminAccountsView },
  { path: '/_/new', name: 'new-repo', component: NewRepoView },
  { path: '/_/new-org', name: 'new-org', component: NewOrgView },
  { path: '/_/orgs', name: 'orgs', component: OrgsView },
  {
    path: '/_/settings',
    component: AccountView,
    children: [
      { path: '', redirect: '/_/settings/keys' },
      { path: 'keys', name: 'keys', component: KeysView, alias: '/_/keys' },
    ],
  },
  { path: '/:owner/-', redirect: { name: 'owner' } },
  {
    path: '/:owner',
    component: OrgView,
    children: [
      { path: '', name: 'owner', component: OwnerView },
      { path: '-/members', name: 'org-members', component: OrgMembersView },
      { path: '-/teams', name: 'org-teams', component: OrgTeamsView },
      { path: '-/teams/:team', name: 'org-team', component: OrgTeamView },
      { path: '-/audit', name: 'org-audit', component: OrgAuditView },
      { path: '-/settings', name: 'org-settings', component: OrgSettingsView },
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
  createRouter({
    history,
    routes,
    scrollBehavior(to) {
      if (to.hash) scrollToHash(to.hash)
    },
  })
