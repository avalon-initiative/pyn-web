export const NAME_RULES =
  'Names are 2 to 39 lowercase letters, digits, "-" or "_", and cannot be a reserved word.'

const RESERVED_WHY =
  'Account and organization names are also the first part of a repository address, so names the web app uses for its own pages, such as admin, login, logout, api, new, explore, help and orgs, cannot be taken.'

export const reservedMessage = (subject: string): string =>
  `${subject} is reserved. ${RESERVED_WHY} ${NAME_RULES}`
