// Shared color palettes, extracted from the store so non-store modules (auth)
// can use them without a circular import. The store re-exports these so every
// existing `import { IDENTITY_COLORS } from '../store/useStore'` keeps working.

/** Palette a commenter picks their bubble color from. */
export const IDENTITY_COLORS = [
  '#7c6cff',
  '#3ad1c4',
  '#ff7a59',
  '#ffc24b',
  '#5b9bff',
  '#ff6b9d',
  '#9bd35a',
  '#c98aff',
  '#ff5c6c',
  '#4ad0e0',
]

/** Lane colors for branches in the version graph. */
export const BRANCH_COLORS = [
  '#7c6cff',
  '#3ad1c4',
  '#ff7a59',
  '#ffc24b',
  '#5b9bff',
  '#ff6b9d',
  '#9bd35a',
]

/** Accent palette for project cards. */
export const PROJECT_COLORS = [
  '#7c6cff',
  '#3ad1c4',
  '#ff7a59',
  '#ffc24b',
  '#5b9bff',
  '#ff6b9d',
  '#9bd35a',
  '#c98aff',
]
