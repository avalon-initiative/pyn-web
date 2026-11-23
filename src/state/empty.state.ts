/** First-commit steps for a repository with no files, using the commands from the getting-started guide. */
export function firstCommitSteps(server: string, user: string, slug: string): string {
  return (
    `Connect the CLI once with "pyn config set --global server ${server}" and "pyn login ${user}", ` +
    `then run "pyn clone ${slug}", add files with "pyn add", save them with "pyn commit -m 'First file'" ` +
    `and publish with "pyn push".`
  )
}

export const LOCKS_HINT =
  'A file marked exclusive needs a lock before it can be published. Take one with "pyn lock <path>" in a workspace; "pyn push" releases it.'
