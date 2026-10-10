import type { Schemas } from '../api/schema'

export type TreeMode = Schemas['TreeMode']
export type TreeEntry = Schemas['TreeEntry']
export type TreeListing = Schemas['TreeListing']
export type ActivityEntry = Schemas['ActivityEntry']
export type RepoSummary = Schemas['RepoSummary']

export interface Crumb {
  label: string
  /** Absent on the current location. */
  href?: string
}
