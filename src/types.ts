// Domain model for Lottie Commenter — a branch-style version-control + feedback
// tool for Lottie animations. Stored entirely client-side in IndexedDB.

export type ID = string

/** The kind of media an asset holds. `lottie` is the original, first-class
 *  citizen (branches, frame pins, compare, approve). The other kinds ride the
 *  same Asset→Version→Comment spine. */
export type MediaKind = 'lottie' | 'image' | 'video' | 'pdf' | 'audio'

export const MEDIA_KINDS: MediaKind[] = ['lottie', 'image', 'video', 'pdf', 'audio']

/** A media kind is "temporal" when it has a playhead/timeline (and thus
 *  frame-anchored comments). Spatial-only kinds (image, pdf) anchor by x/y. */
export const isTemporalKind = (k: MediaKind) =>
  k === 'lottie' || k === 'video' || k === 'audio'
/** A kind that renders a visual frame the user can drop an x/y pin on. */
export const isVisualKind = (k: MediaKind) =>
  k === 'lottie' || k === 'video' || k === 'image'

/** Asset-level review status (Frame.io's top-right status selector). Distinct
 *  from per-comment CommentStatus — this rolls up the whole asset. */
export type AssetStatus = 'draft' | 'in_review' | 'needs_changes' | 'approved'
export const ASSET_STATUSES: AssetStatus[] = [
  'draft',
  'in_review',
  'needs_changes',
  'approved',
]

/** A top-level container that groups assets (Frame.io Project). */
export interface Project {
  id: ID
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  /** hex accent color for the project card + lane. */
  color: string
  /** manual sort order on the projects landing grid. */
  order: number
}

/** Lifecycle of a single feedback note. Mirrors review-status models from
 *  Frame.io / Figma / BugHerd (open → in-progress → resolved / wont-fix). */
export type CommentStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix'

/** Category label on a feedback note. Drives the colored tag chip + filters. */
export type CommentTag =
  | 'fix'
  | 'timing'
  | 'color'
  | 'shape'
  | 'easing'
  | 'question'
  | 'idea'

export const COMMENT_TAGS: CommentTag[] = [
  'fix',
  'timing',
  'color',
  'shape',
  'easing',
  'question',
  'idea',
]

export const COMMENT_STATUSES: CommentStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'wont_fix',
]

/** A named asset. Owns branches + versions + comments. One media kind per
 *  asset; every version of it shares that kind. */
export interface Asset {
  id: ID
  name: string
  description?: string
  createdAt: number
  updatedAt: number
  defaultBranchId: ID
  /** data-URL thumbnail of the latest version's first meaningful frame. */
  thumbnail?: string
  /** which project this asset lives in (every asset has exactly one home). */
  projectId: ID
  /** the media kind — gates rendering, comment anchoring, branch UI. */
  kind: MediaKind
  /** asset-level review status (rolls up the whole asset). */
  status: AssetStatus
  /** optional 0–5 star rating, like Frame.io. */
  rating?: number
}

/** A line of development. `main` is the default; others fork from a version. */
export interface Branch {
  id: ID
  assetId: ID
  name: string
  parentBranchId: ID | null
  /** the version this branch was forked from (null for the root main branch). */
  forkedFromVersionId: ID | null
  createdAt: number
  isDefault: boolean
  /** hex color used to draw this branch's lane in the version graph. */
  color: string
  status: 'active' | 'merged' | 'archived'
}

/** Static facts pulled out of a media file once, at upload time. Named for
 *  its Lottie origin but used as the universal per-version meta for every
 *  kind, so all existing `version.meta.*` reads keep working. For non-temporal
 *  kinds the frame/fps fields are 0; for non-vector kinds layer fields are
 *  empty. */
export interface LottieMeta {
  width: number
  height: number
  frameRate: number
  inPoint: number
  outPoint: number
  totalFrames: number
  durationSec: number
  layerCount: number
  layerNames: string[]
  fileName: string
  fileSize: number
  bodymovinVersion?: string
  /** number of pages, for pdf assets. */
  pageCount?: number
}
/** Alias making the universal-meta intent explicit at non-Lottie call sites. */
export type MediaMeta = LottieMeta

/** A snapshot = one uploaded Lottie file on a branch (a "commit"). */
export interface Version {
  id: ID
  assetId: ID
  branchId: ID
  /** sequential within its branch (v1, v2 …). */
  number: number
  /** sequential across the whole asset, for stable global labels. */
  globalNumber: number
  message: string
  createdAt: number
  author: string
  parentVersionId: ID | null
  meta: LottieMeta
  /** denormalized media kind (== owning asset's kind), so renderers/compare
   *  can dispatch from a Version alone without looking up the asset. */
  kind: MediaKind
  /** marked approved in review. */
  approved: boolean
}

export interface Reply {
  id: ID
  author: string
  /** the reply author's chosen bubble color (hex). */
  authorColor: string
  body: string
  createdAt: number
}

/** A pinned feedback note on a specific version, anchored to frame + xy. */
export interface Comment {
  id: ID
  assetId: ID
  versionId: ID
  /** pin order within the version (1, 2, 3 …) — shown inside the marker dot. */
  number: number
  /** the frame the pin was dropped on. */
  frame: number
  /** normalized canvas position, 0..1 (resolution-independent). */
  x: number
  y: number
  /** optional targeted Lottie layer name. */
  layerName?: string
  body: string
  tag: CommentTag
  status: CommentStatus
  author: string
  /** the author's chosen bubble color (hex) — colors the canvas pin + badge. */
  authorColor: string
  createdAt: number
  updatedAt: number
  /** set when the same note is confirmed fixed in a later version. */
  resolvedInVersionId?: ID
  replies: Reply[]
}

/** The heavy media payload for a version, in its own object store keyed by
 *  version. Lottie stores parsed JSON in `data` (unchanged); other kinds store
 *  raw bytes in `file` (a Blob). */
export interface LottieBlob {
  versionId: ID
  /** parsed bodymovin animationData object (lottie kind only). */
  data?: unknown
  /** raw file bytes (image/video/pdf/audio kinds). */
  file?: Blob
  /** which field is populated; absent on legacy lottie blobs. */
  kind?: MediaKind
}
export type MediaBlob = LottieBlob
